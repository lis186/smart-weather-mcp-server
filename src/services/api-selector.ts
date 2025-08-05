/**
 * API Selection Logic for Google Weather APIs
 * Intelligently selects the most appropriate Google Weather API based on parsed query intent
 */

import {
  APIEndpoint,
  GoogleWeatherAPIConfig,
  ParsedWeatherQuery,
  RoutingContext,
  RoutingDecision,
  WeatherIntent,
  APIHealthStatus
} from '../types/routing.js';
import { logger } from './logger.js';

export class APISelector {
  private readonly googleAPIs: GoogleWeatherAPIConfig;
  private readonly healthCache: Map<string, APIHealthStatus> = new Map();
  private readonly responseTimeWindow = 100; // Keep last 100 response times

  constructor() {
    this.googleAPIs = this.initializeGoogleAPIs();
  }

  /**
   * Select the best API endpoint for a parsed weather query
   */
  async selectAPI(
    query: ParsedWeatherQuery,
    context: RoutingContext
  ): Promise<RoutingDecision> {
    const startTime = Date.now();
    
    try {
      // Get candidate APIs based on intent
      const candidates = this.getCandidateAPIs(query);
      
      if (candidates.length === 0) {
        throw new Error(`No suitable APIs found for intent: ${query.intent.primary}`);
      }

      // Score and rank candidates
      const scoredAPIs = await this.scoreAPIs(candidates, query, context);
      
      // Select the best API
      const selectedAPI = scoredAPIs[0];
      const fallbacks = scoredAPIs.slice(1, 4); // Top 3 fallbacks

      // Build API parameters
      const apiParameters = this.buildAPIParameters(selectedAPI.api, query);

      const decision: RoutingDecision = {
        selectedAPI: selectedAPI.api,
        confidence: selectedAPI.score,
        apiParameters,
        fallbacks: fallbacks.map(f => f.api),
        reasoning: selectedAPI.reasoning,
        estimatedResponseTime: this.estimateResponseTime(selectedAPI.api.id, context)
      };

      logger.debug('API selection completed', {
        selectedAPI: selectedAPI.api.id,
        confidence: selectedAPI.score,
        processingTime: Date.now() - startTime,
        fallbackCount: fallbacks.length
      });

      return decision;

    } catch (error) {
      logger.error('API selection failed', { 
        intent: query.intent.primary,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get candidate APIs that support the query intent
   */
  private getCandidateAPIs(query: ParsedWeatherQuery): APIEndpoint[] {
    const candidates: APIEndpoint[] = [];
    const primaryIntent = query.intent.primary;
    const secondaryIntents = query.intent.secondary || [];

    // Check all Google APIs for intent support
    for (const api of Object.values(this.googleAPIs)) {
      if (api.supportedIntents.includes(primaryIntent)) {
        candidates.push(api);
      } else if (secondaryIntents.some(intent => api.supportedIntents.includes(intent))) {
        candidates.push(api);
      }
    }

    // Add special handling for location queries
    if (primaryIntent === 'location_search' || !query.location.coordinates) {
      candidates.push(this.googleAPIs.geocoding, this.googleAPIs.places);
    }

    return candidates;
  }

  /**
   * Score APIs based on multiple criteria
   */
  private async scoreAPIs(
    candidates: APIEndpoint[],
    query: ParsedWeatherQuery,
    context: RoutingContext
  ): Promise<Array<{ api: APIEndpoint; score: number; reasoning: string }>> {
    
    const scoredAPIs = candidates.map(api => {
      let score = 0;
      const reasons: string[] = [];

      // Intent match score (40% weight)
      const intentScore = this.calculateIntentScore(api, query);
      score += intentScore * 0.4;
      reasons.push(`intent match: ${intentScore.toFixed(2)}`);

      // API health score (25% weight)
      const healthScore = this.calculateHealthScore(api.id, context);
      score += healthScore * 0.25;
      reasons.push(`health: ${healthScore.toFixed(2)}`);

      // Performance score (20% weight)
      const performanceScore = this.calculatePerformanceScore(api.id, context);
      score += performanceScore * 0.2;
      reasons.push(`performance: ${performanceScore.toFixed(2)}`);

      // Data completeness score (10% weight)
      const completenessScore = this.calculateCompletenessScore(api, query);
      score += completenessScore * 0.1;
      reasons.push(`completeness: ${completenessScore.toFixed(2)}`);

      // User preference bonus (5% weight)
      const preferenceScore = this.calculatePreferenceScore(api.id, context);
      score += preferenceScore * 0.05;
      reasons.push(`preference: ${preferenceScore.toFixed(2)}`);

      return {
        api,
        score,
        reasoning: `Scored ${score.toFixed(2)}: ${reasons.join(', ')}`
      };
    });

    // Sort by score descending
    return scoredAPIs.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate how well an API matches the query intent
   */
  private calculateIntentScore(api: APIEndpoint, query: ParsedWeatherQuery): number {
    const primaryIntent = query.intent.primary;
    const secondaryIntents = query.intent.secondary || [];

    // Perfect match for primary intent
    if (api.supportedIntents.includes(primaryIntent)) {
      return 1.0;
    }

    // Partial match for secondary intents
    const secondaryMatches = secondaryIntents.filter(intent => 
      api.supportedIntents.includes(intent)
    ).length;

    if (secondaryMatches > 0) {
      return 0.5 + (secondaryMatches / secondaryIntents.length) * 0.3;
    }

    // Special scoring for related intents
    return this.getRelatedIntentScore(api, primaryIntent);
  }

  /**
   * Calculate API health score based on recent performance
   */
  private calculateHealthScore(apiId: string, context: RoutingContext): number {
    const healthStatus = context.apiHealth[apiId];
    
    switch (healthStatus) {
      case 'healthy':
        return 1.0;
      case 'degraded':
        return 0.6;
      case 'unavailable':
        return 0.0;
      default:
        return 0.8; // Unknown status, assume decent
    }
  }

  /**
   * Calculate performance score based on response times
   */
  private calculatePerformanceScore(apiId: string, context: RoutingContext): number {
    const responseTimes = context.responseTimeHistory[apiId];
    
    if (!responseTimes || responseTimes.length === 0) {
      return 0.7; // Default score for unknown performance
    }

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    // Score based on response time (lower is better)
    if (avgResponseTime < 200) return 1.0;
    if (avgResponseTime < 500) return 0.9;
    if (avgResponseTime < 1000) return 0.7;
    if (avgResponseTime < 2000) return 0.5;
    return 0.2;
  }

  /**
   * Calculate data completeness score for the query
   */
  private calculateCompletenessScore(api: APIEndpoint, query: ParsedWeatherQuery): number {
    const requiredMetrics = query.dataPreferences.metrics;
    const timeframe = query.timeframe.type;
    
    // This would be based on API documentation/capabilities
    // For now, use heuristics based on API type and timeframe
    switch (api.id) {
      case 'google_current_conditions':
        // Favor current conditions API for current queries, penalize for forecast queries
        if (timeframe === 'current') return requiredMetrics.includes('temperature') ? 1.0 : 0.8;
        if (timeframe === 'forecast') return 0.3; // Low score for forecast queries
        return requiredMetrics.includes('temperature') ? 0.8 : 0.6;
      case 'google_daily_forecast':
        // Favor daily forecast API for forecast queries
        if (timeframe === 'forecast') return requiredMetrics.some(m => ['temperature', 'precipitation'].includes(m)) ? 1.0 : 0.8;
        if (timeframe === 'current') return 0.4; // Lower score for current queries
        return requiredMetrics.some(m => ['temperature', 'precipitation'].includes(m)) ? 0.7 : 0.5;
      case 'google_hourly_forecast':
        // Good for forecast queries, less good for current
        if (timeframe === 'forecast') return 0.9;
        if (timeframe === 'current') return 0.5;
        return 0.7;
      case 'google_hourly_history':
        return query.timeframe.type === 'historical' ? 1.0 : 0.3;
      default:
        return 0.5;
    }
  }

  /**
   * Calculate user preference score
   */
  private calculatePreferenceScore(apiId: string, context: RoutingContext): number {
    const preferences = context.userPreferences;
    
    if (!preferences?.preferredAPIs) {
      return 0.5; // Neutral if no preferences
    }

    const rank = preferences.preferredAPIs.indexOf(apiId);
    if (rank === -1) return 0.3; // Not in preferences
    
    // Higher score for higher-ranked preferences
    return 1.0 - (rank / preferences.preferredAPIs.length) * 0.7;
  }

  /**
   * Get related intent score for fallback matching
   */
  private getRelatedIntentScore(api: APIEndpoint, intent: WeatherIntent): number {
    const relationMap: Record<WeatherIntent, WeatherIntent[]> = {
      'current_conditions': ['daily_forecast', 'hourly_forecast'],
      'daily_forecast': ['current_conditions', 'hourly_forecast'],
      'hourly_forecast': ['current_conditions', 'daily_forecast'],
      'historical_data': ['current_conditions'],
      'location_search': [],
      'weather_advice': ['current_conditions', 'daily_forecast'],
      'severe_weather': ['current_conditions', 'hourly_forecast'],
      'planning_advice': ['daily_forecast', 'hourly_forecast']
    };

    const relatedIntents = relationMap[intent] || [];
    const matches = api.supportedIntents.filter(supportedIntent => 
      relatedIntents.includes(supportedIntent)
    ).length;

    return matches > 0 ? 0.3 + (matches / relatedIntents.length) * 0.2 : 0.0;
  }

  /**
   * Build API-specific parameters from parsed query
   */
  private buildAPIParameters(api: APIEndpoint, query: ParsedWeatherQuery): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Common parameters
    if (query.location.coordinates) {
      params.lat = query.location.coordinates.lat;
      params.lng = query.location.coordinates.lng;
    } else if (query.location.name) {
      params.location = query.location.name;
    }

    if (query.location.placeId) {
      params.placeId = query.location.placeId;
    }

    // Unit preferences
    if (query.dataPreferences.units) {
      params.units = query.dataPreferences.units;
    }

    // Language preferences
    if (query.dataPreferences.language) {
      params.language = query.dataPreferences.language;
    }

    // API-specific parameters
    switch (api.id) {
      case 'google_daily_forecast':
        params.forecast_days = this.extractForecastDays(query);
        break;
      case 'google_hourly_forecast':
        params.forecast_hours = this.extractForecastHours(query);
        break;
      case 'google_hourly_history':
        if (query.timeframe.startTime) {
          params.start_time = query.timeframe.startTime.toISOString();
        }
        if (query.timeframe.endTime) {
          params.end_time = query.timeframe.endTime.toISOString();
        }
        break;
    }

    // Add required fields from API definition
    api.requiredParams.forEach(param => {
      if (!(param in params)) {
        // Set defaults for required params
        switch (param) {
          case 'units':
            params[param] = 'metric';
            break;
          case 'language':
            params[param] = 'en';
            break;
        }
      }
    });

    return params;
  }

  /**
   * Estimate response time for an API
   */
  private estimateResponseTime(apiId: string, context: RoutingContext): number {
    const responseTimes = context.responseTimeHistory[apiId];
    
    if (!responseTimes || responseTimes.length === 0) {
      // Default estimates based on API type
      switch (apiId) {
        case 'google_current_conditions': return 300;
        case 'google_daily_forecast': return 400;
        case 'google_hourly_forecast': return 500;
        case 'google_hourly_history': return 800;
        case 'google_geocoding': return 200;
        case 'google_places': return 250;
        default: return 500;
      }
    }

    // Use recent average with some padding
    const recentTimes = responseTimes.slice(-10); // Last 10 requests
    const average = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
    return Math.round(average * 1.2); // Add 20% buffer
  }

  /**
   * Extract forecast days from query
   */
  private extractForecastDays(query: ParsedWeatherQuery): number {
    const duration = query.timeframe.duration;
    if (!duration) return 5; // Default 5 days

    const dayMatch = duration.match(/(\d+)\s*days?/i);
    if (dayMatch) {
      return Math.min(parseInt(dayMatch[1]), 10); // Max 10 days
    }

    // If timeframe has specific dates
    if (query.timeframe.startTime && query.timeframe.endTime) {
      const diffTime = query.timeframe.endTime.getTime() - query.timeframe.startTime.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.min(diffDays, 10);
    }

    return 5; // Default
  }

  /**
   * Extract forecast hours from query
   */
  private extractForecastHours(query: ParsedWeatherQuery): number {
    const duration = query.timeframe.duration;
    if (!duration) return 24; // Default 24 hours

    const hourMatch = duration.match(/(\d+)\s*hours?/i);
    if (hourMatch) {
      return Math.min(parseInt(hourMatch[1]), 72); // Max 72 hours
    }

    const dayMatch = duration.match(/(\d+)\s*days?/i);
    if (dayMatch) {
      return Math.min(parseInt(dayMatch[1]) * 24, 72);
    }

    return 24; // Default
  }

  /**
   * Initialize Google Weather API configurations
   */
  private initializeGoogleAPIs(): GoogleWeatherAPIConfig {
    return {
      currentConditions: {
        id: 'google_current_conditions',
        name: 'Google Current Conditions API',
        endpoint: '/maps/api/weather/current',
        category: 'weather',
        supportedIntents: ['current_conditions', 'weather_advice'],
        requiredParams: ['lat', 'lng'],
        optionalParams: ['units', 'language'],
        rateLimit: {
          requestsPerMinute: 300,
          requestsPerDay: 10000
        }
      },
      dailyForecast: {
        id: 'google_daily_forecast',
        name: 'Google Daily Forecast API',
        endpoint: '/maps/api/weather/forecast/daily',
        category: 'weather',
        supportedIntents: ['daily_forecast', 'planning_advice', 'weather_advice'],
        requiredParams: ['lat', 'lng'],
        optionalParams: ['units', 'language', 'forecast_days'],
        rateLimit: {
          requestsPerMinute: 200,
          requestsPerDay: 8000
        }
      },
      hourlyForecast: {
        id: 'google_hourly_forecast',
        name: 'Google Hourly Forecast API',
        endpoint: '/maps/api/weather/forecast/hourly',
        category: 'weather',
        supportedIntents: ['hourly_forecast', 'planning_advice', 'severe_weather'],
        requiredParams: ['lat', 'lng'],
        optionalParams: ['units', 'language', 'forecast_hours'],
        rateLimit: {
          requestsPerMinute: 150,
          requestsPerDay: 6000
        }
      },
      hourlyHistory: {
        id: 'google_hourly_history',
        name: 'Google Hourly History API',
        endpoint: '/maps/api/weather/history/hourly',
        category: 'weather',
        supportedIntents: ['historical_data'],
        requiredParams: ['lat', 'lng', 'start_time', 'end_time'],
        optionalParams: ['units', 'language'],
        rateLimit: {
          requestsPerMinute: 100,
          requestsPerDay: 4000
        }
      },
      geocoding: {
        id: 'google_geocoding',
        name: 'Google Geocoding API',
        endpoint: '/maps/api/geocode/json',
        category: 'geocoding',
        supportedIntents: ['location_search'],
        requiredParams: ['address'],
        optionalParams: ['region', 'language'],
        rateLimit: {
          requestsPerMinute: 500,
          requestsPerDay: 25000
        }
      },
      places: {
        id: 'google_places',
        name: 'Google Places API',
        endpoint: '/maps/api/place/textsearch/json',
        category: 'places',
        supportedIntents: ['location_search'],
        requiredParams: ['query'],
        optionalParams: ['location', 'radius', 'language'],
        rateLimit: {
          requestsPerMinute: 400,
          requestsPerDay: 20000
        }
      }
    };
  }

  /**
   * Update API health status
   */
  updateAPIHealth(apiId: string, health: APIHealthStatus): void {
    this.healthCache.set(apiId, health);
    
    logger.debug('API health updated', {
      apiId,
      status: health.status,
      avgResponseTime: health.avgResponseTime,
      successRate: health.successRate
    });
  }

  /**
   * Get current API health status
   */
  getAPIHealth(apiId: string): APIHealthStatus | undefined {
    return this.healthCache.get(apiId);
  }

  /**
   * Get all available APIs
   */
  getAvailableAPIs(): APIEndpoint[] {
    return Object.values(this.googleAPIs);
  }
}