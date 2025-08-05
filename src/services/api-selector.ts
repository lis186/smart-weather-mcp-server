/**
 * API Selector Service for Smart Weather MCP Server
 * Implements strategy pattern for intelligent API selection based on query criteria
 */

import { 
  ParsedWeatherQuery, 
  RoutingContext, 
  WeatherIntent,
  WeatherAPIResponse 
} from '../types/routing.js';
import { logger } from './logger.js';

/**
 * Criteria for API selection scoring
 */
interface APISelectionCriteria {
  /** Intent match score (0-1) */
  intentMatch: number;
  
  /** Geographic coverage score (0-1) */
  geographicCoverage: number;
  
  /** Data freshness score (0-1) */
  dataFreshness: number;
  
  /** API reliability score (0-1) */
  reliability: number;
  
  /** Response time score (0-1) */
  responseTime: number;
  
  /** Cost efficiency score (0-1) */
  costEfficiency: number;
}

/**
 * API metadata for selection decisions
 */
interface APIMetadata {
  name: string;
  capabilities: WeatherIntent[];
  geographicCoverage: string[];
  dataTypes: string[];
  averageLatency: number;
  reliability: number;
  costPerRequest: number;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

/**
 * API selection result with scoring details
 */
interface APISelectionResult {
  selectedAPI: string;
  confidence: number;
  scores: APISelectionCriteria;
  reasoning: string;
  alternatives: Array<{
    api: string;
    score: number;
    reason: string;
  }>;
}

export class APISelector {
  private readonly apiRegistry: Map<string, APIMetadata> = new Map();

  constructor() {
    this.initializeAPIRegistry();
  }

  /**
   * Select the best API for a given query and context
   */
  selectAPI(
    parsedQuery: ParsedWeatherQuery, 
    context: RoutingContext
  ): APISelectionResult {
    const startTime = Date.now();
    
    logger.info('Starting API selection', {
      intent: parsedQuery.intent,
      location: parsedQuery.location,
      timeScope: parsedQuery.timeScope.type
    });

    // Get all viable API candidates
    const candidates = this.getAPICandidates(parsedQuery);
    
    if (candidates.length === 0) {
      throw new Error(`No suitable APIs found for intent: ${parsedQuery.intent}`);
    }

    // Score each candidate
    const scoredCandidates = candidates.map(api => ({
      api: api.name,
      score: this.scoreAPI(api, parsedQuery, context),
      metadata: api
    }));

    // Sort by score (highest first)
    scoredCandidates.sort((a, b) => b.score.total - a.score.total);

    const selectedCandidate = scoredCandidates[0];
    const selectionTime = Date.now() - startTime;

    logger.info('API selection completed', {
      selectedAPI: selectedCandidate.api,
      totalScore: selectedCandidate.score.total,
      selectionTime: `${selectionTime}ms`
    });

    return {
      selectedAPI: selectedCandidate.api,
      confidence: selectedCandidate.score.total,
      scores: selectedCandidate.score.breakdown,
      reasoning: this.generateSelectionReasoning(selectedCandidate, parsedQuery),
      alternatives: scoredCandidates.slice(1, 4).map(candidate => ({
        api: candidate.api,
        score: candidate.score.total,
        reason: `Score: ${candidate.score.total.toFixed(2)} - ${this.getTopCriteria(candidate.score.breakdown)}`
      }))
    };
  }

  /**
   * Get viable API candidates for the query
   */
  private getAPICandidates(parsedQuery: ParsedWeatherQuery): APIMetadata[] {
    const candidates: APIMetadata[] = [];

    for (const [, api] of this.apiRegistry) {
      // Check if API supports the required intent
      if (api.capabilities.includes(parsedQuery.intent) || 
          api.capabilities.includes('unknown')) {
        candidates.push(api);
      }
    }

    return candidates;
  }

  /**
   * Score an API for the given query and context
   */
  private scoreAPI(
    api: APIMetadata, 
    parsedQuery: ParsedWeatherQuery, 
    context: RoutingContext
  ): { total: number; breakdown: APISelectionCriteria } {
    const breakdown: APISelectionCriteria = {
      intentMatch: this.scoreIntentMatch(api, parsedQuery),
      geographicCoverage: this.scoreGeographicCoverage(api, parsedQuery),
      dataFreshness: this.scoreDataFreshness(api, parsedQuery),
      reliability: this.scoreReliability(api, context),
      responseTime: this.scoreResponseTime(api, context),
      costEfficiency: this.scoreCostEfficiency(api, context)
    };

    // Weighted total score
    const weights = {
      intentMatch: 0.3,
      geographicCoverage: 0.2,
      dataFreshness: 0.2,
      reliability: 0.15,
      responseTime: 0.1,
      costEfficiency: 0.05
    };

    const total = Object.entries(breakdown).reduce((sum, [criterion, score]) => {
      return sum + (score * weights[criterion as keyof APISelectionCriteria]);
    }, 0);

    return { total, breakdown };
  }

  /**
   * Score how well the API matches the query intent
   */
  private scoreIntentMatch(api: APIMetadata, parsedQuery: ParsedWeatherQuery): number {
    if (api.capabilities.includes(parsedQuery.intent)) {
      return 1.0;
    }
    
    // Partial matches for related intents
    const intentCompatibility: Record<WeatherIntent, WeatherIntent[]> = {
      'current_conditions': ['forecast', 'air_quality'],
      'forecast': ['current_conditions', 'weather_advice'],
      'historical': ['current_conditions'],
      'air_quality': ['current_conditions', 'weather_advice'],
      'marine_conditions': ['current_conditions', 'forecast'],
      'weather_advice': ['current_conditions', 'forecast', 'air_quality'],
      'location_search': [],
      'unknown': []
    };

    const relatedIntents = intentCompatibility[parsedQuery.intent] || [];
    for (const relatedIntent of relatedIntents) {
      if (api.capabilities.includes(relatedIntent)) {
        return 0.6; // Partial match
      }
    }

    return 0.1; // Minimal compatibility
  }

  /**
   * Score geographic coverage for the query location
   */
  private scoreGeographicCoverage(api: APIMetadata, parsedQuery: ParsedWeatherQuery): number {
    if (!parsedQuery.location) {
      return 0.8; // Neutral score for non-location-specific queries
    }

    // Check if API covers the requested location
    // This is simplified - in production, you'd use more sophisticated geo-matching
    const hasGlobalCoverage = api.geographicCoverage.includes('global');
    const hasRegionalCoverage = api.geographicCoverage.some(region => 
      parsedQuery.location?.toLowerCase().includes(region.toLowerCase())
    );

    if (hasGlobalCoverage) return 1.0;
    if (hasRegionalCoverage) return 0.9;
    return 0.3; // Limited coverage
  }

  /**
   * Score data freshness based on query time scope
   */
  private scoreDataFreshness(api: APIMetadata, parsedQuery: ParsedWeatherQuery): number {
    const timeScope = parsedQuery.timeScope.type;
    
    // Different APIs have different strengths for different time scopes
    const freshnessMap: Record<string, Record<string, number>> = {
      'google_current_conditions': { current: 1.0, forecast: 0.7, historical: 0.3 },
      'google_daily_forecast': { current: 0.8, forecast: 1.0, historical: 0.2 },
      'google_hourly_forecast': { current: 0.8, forecast: 1.0, historical: 0.2 },
      'google_hourly_history': { current: 0.3, forecast: 0.1, historical: 1.0 }
    };

    return freshnessMap[api.name]?.[timeScope] || 0.5;
  }

  /**
   * Score API reliability based on health metrics
   */
  private scoreReliability(api: APIMetadata, context: RoutingContext): number {
    const healthInfo = context.apiHealth?.[api.name];
    
    if (!healthInfo) {
      return api.reliability; // Use baseline reliability
    }

    if (!healthInfo.available) {
      return 0.0; // API is down
    }

    // Factor in error rate
    const errorRate = healthInfo.errorRate || 0;
    const reliabilityPenalty = Math.min(errorRate * 2, 0.5); // Max 50% penalty
    
    return Math.max(api.reliability - reliabilityPenalty, 0.1);
  }

  /**
   * Score API response time
   */
  private scoreResponseTime(api: APIMetadata, context: RoutingContext): number {
    const healthInfo = context.apiHealth?.[api.name];
    const currentLatency = healthInfo?.latency || api.averageLatency;
    
    // Score based on response time (lower is better)
    // Excellent: < 200ms, Good: < 500ms, Acceptable: < 1000ms, Poor: > 1000ms
    if (currentLatency < 200) return 1.0;
    if (currentLatency < 500) return 0.8;
    if (currentLatency < 1000) return 0.6;
    if (currentLatency < 2000) return 0.3;
    return 0.1;
  }

  /**
   * Score cost efficiency
   */
  private scoreCostEfficiency(api: APIMetadata, context: RoutingContext): number {
    const rateLimitInfo = context.rateLimitInfo;
    
    // If we're close to rate limits, prefer cheaper APIs
    if (rateLimitInfo && rateLimitInfo.remaining < 100) {
      // Prefer lower cost APIs when approaching limits
      return 1.0 - Math.min(api.costPerRequest / 0.001, 1.0); // Normalize to $0.001 max
    }
    
    // Normal cost efficiency scoring
    return 1.0 - Math.min(api.costPerRequest / 0.0005, 0.8); // Max 80% penalty for high cost
  }

  /**
   * Generate human-readable reasoning for API selection
   */
  private generateSelectionReasoning(
    selectedCandidate: any, 
    parsedQuery: ParsedWeatherQuery
  ): string {
    const reasons: string[] = [];
    const scores = selectedCandidate.score.breakdown;
    
    if (scores.intentMatch > 0.8) {
      reasons.push(`perfect match for ${parsedQuery.intent} queries`);
    } else if (scores.intentMatch > 0.5) {
      reasons.push(`good compatibility with ${parsedQuery.intent} intent`);
    }
    
    if (scores.geographicCoverage > 0.8) {
      reasons.push(`excellent coverage for ${parsedQuery.location || 'requested area'}`);
    }
    
    if (scores.reliability > 0.9) {
      reasons.push('high reliability');
    }
    
    if (scores.responseTime > 0.8) {
      reasons.push('fast response time');
    }

    return reasons.join(', ') || 'best overall score among available options';
  }

  /**
   * Get the top scoring criteria for an API
   */
  private getTopCriteria(scores: APISelectionCriteria): string {
    const criteria = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([criterion]) => criterion.replace(/([A-Z])/g, ' $1').toLowerCase())
      .join(', ');
    
    return criteria;
  }

  /**
   * Initialize the API registry with metadata
   */
  private initializeAPIRegistry(): void {
    // Google Current Conditions API
    this.apiRegistry.set('google_current_conditions', {
      name: 'google_current_conditions',
      capabilities: ['current_conditions', 'air_quality'],
      geographicCoverage: ['global'],
      dataTypes: ['temperature', 'humidity', 'pressure', 'wind', 'visibility', 'uv_index'],
      averageLatency: 300,
      reliability: 0.99,
      costPerRequest: 0.0002,
      rateLimit: {
        requestsPerMinute: 1000,
        requestsPerDay: 100000
      }
    });

    // Google Daily Forecast API
    this.apiRegistry.set('google_daily_forecast', {
      name: 'google_daily_forecast',
      capabilities: ['forecast', 'weather_advice'],
      geographicCoverage: ['global'],
      dataTypes: ['temperature', 'precipitation', 'wind', 'conditions'],
      averageLatency: 400,
      reliability: 0.98,
      costPerRequest: 0.0003,
      rateLimit: {
        requestsPerMinute: 800,
        requestsPerDay: 80000
      }
    });

    // Google Hourly Forecast API
    this.apiRegistry.set('google_hourly_forecast', {
      name: 'google_hourly_forecast',
      capabilities: ['forecast', 'weather_advice'],
      geographicCoverage: ['global'],
      dataTypes: ['temperature', 'precipitation', 'wind', 'humidity'],
      averageLatency: 450,
      reliability: 0.98,
      costPerRequest: 0.0003,
      rateLimit: {
        requestsPerMinute: 600,
        requestsPerDay: 60000
      }
    });

    // Google Historical Data API
    this.apiRegistry.set('google_hourly_history', {
      name: 'google_hourly_history',
      capabilities: ['historical'],
      geographicCoverage: ['global'],
      dataTypes: ['temperature', 'precipitation', 'wind', 'pressure'],
      averageLatency: 600,
      reliability: 0.97,
      costPerRequest: 0.0004,
      rateLimit: {
        requestsPerMinute: 400,
        requestsPerDay: 40000
      }
    });

    // Google Geocoding API
    this.apiRegistry.set('google_geocoding', {
      name: 'google_geocoding',
      capabilities: ['location_search'],
      geographicCoverage: ['global'],
      dataTypes: ['coordinates', 'place_names', 'administrative_areas'],
      averageLatency: 200,
      reliability: 0.99,
      costPerRequest: 0.0001,
      rateLimit: {
        requestsPerMinute: 1500,
        requestsPerDay: 150000
      }
    });

    // Google Places API
    this.apiRegistry.set('google_places', {
      name: 'google_places',
      capabilities: ['location_search'],
      geographicCoverage: ['global'],
      dataTypes: ['places', 'business_locations', 'landmarks'],
      averageLatency: 250,
      reliability: 0.98,
      costPerRequest: 0.0002,
      rateLimit: {
        requestsPerMinute: 1000,
        requestsPerDay: 100000
      }
    });

    logger.info('API registry initialized', {
      registeredAPIs: Array.from(this.apiRegistry.keys()),
      totalAPIs: this.apiRegistry.size
    });
  }
}