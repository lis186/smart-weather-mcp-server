/**
 * Simplified Query Router for Smart Weather MCP Server
 * Routes weather queries to appropriate Google Weather APIs based on parsed intent
 */

import {
  ParsedWeatherQuery,
  RoutingContext,
  RoutingResult,
  RoutingDecision,
  QueryRouterConfig,
  WeatherIntent,
  WeatherMetric
} from '../types/routing.js';
import { WeatherQuery } from '../types/index.js';
import { APISelector } from './api-selector.js';
import { logger } from './logger.js';
import { timeService, TimeContext } from './time-service.js';

export class QueryRouter {
  private readonly apiSelector: APISelector;
  private readonly config: QueryRouterConfig;
  private readonly geminiParser?: any;

  constructor(geminiParser?: any, config?: Partial<QueryRouterConfig>) {
    this.apiSelector = new APISelector();
    this.geminiParser = geminiParser;
    this.config = {
      defaultLanguage: 'en',
      defaultUnits: 'metric',
      maxProcessingTime: 2000,
      minConfidenceThreshold: 0.3,
      aiThreshold: 0.50, // 符合 Smart Weather 原則：0.5 with AI available
      enableFallbacks: true,
      apiPriority: ['google_current_conditions', 'google_daily_forecast'],
      caching: { enabled: true, ttl: 300000, maxSize: 1000 },
      ...config
    };
  }

  /**
   * Route a weather query to the most appropriate API
   */
  async routeQuery(
    query: WeatherQuery & { userContext?: string },
    context?: RoutingContext
  ): Promise<RoutingResult> {
    const startTime = Date.now();
    
    try {
      // Create time context for query
      const timeContext = await timeService.createTimeContext(query.query);
      
      // Parse the query into structured format (hybrid rule-based + AI fallback)
      const parsedQuery = await this.parseQuery(query, timeContext);
      
      // Create routing context with defaults
      const routingContext: RoutingContext = context || {
        apiHealth: {},
        timestamp: new Date()
      };

      // Select API using the apiSelector
      const apiSelection = this.apiSelector.selectAPI(parsedQuery, routingContext);
      
      // Create routing decision
      const decision: RoutingDecision = {
        selectedAPI: {
          id: apiSelection.selectedAPI,
          name: `${apiSelection.selectedAPI.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} API`,
          endpoint: `/maps/api/weather/${apiSelection.selectedAPI.split('_').pop()}`,
          category: 'weather',
          supportedIntents: this.getSupportedIntents(apiSelection.selectedAPI),
          requiredParams: ['location'],
          optionalParams: ['units', 'language']
        },
        confidence: apiSelection.confidence || 0.5,
        apiParameters: { location: parsedQuery.location.name, units: 'metric' },
        fallbacks: apiSelection.alternatives.map(alt => alt.api),
        reasoning: apiSelection.reasoning || 'Default routing decision',
        estimatedResponseTime: 300
      };
      
      // Create successful result
      const result: RoutingResult = {
        success: true,
        decision,
        parsedQuery,
        metadata: {
          parsingConfidence: parsedQuery.confidence,
          processingTime: Date.now() - startTime,
          parsingSource: parsedQuery.parsingSource
        }
      };

      return result;

    } catch (error) {
      logger.error('Query routing failed', { 
        query: query.query,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return error result
      return {
        success: false,
        metadata: {
          parsingConfidence: 0,
          processingTime: Date.now() - startTime,
          parsingSource: 'rules_fallback'
        },
        error: {
          code: 'ROUTING_FAILED',
          message: error instanceof Error ? error.message : String(error),
          suggestions: ['Try specifying a clear location and weather information type.']
        }
      };
    }
  }

  /**
   * Get supported intents for an API
   */
  private getSupportedIntents(apiId: string): string[] {
    const intentMap: Record<string, string[]> = {
      'google_current_conditions': ['current_conditions', 'air_quality'],
      'google_daily_forecast': ['forecast', 'weather_advice'],
      'google_hourly_forecast': ['forecast', 'weather_advice'],
      'google_hourly_history': ['historical'],
      'google_geocoding': ['location_search'],
      'google_places': ['location_search']
    };
    
    return intentMap[apiId] || ['unknown'];
  }

  /**
   * Hybrid query parsing with rule-based first, AI fallback for complex cases
   */
  private async parseQuery(query: WeatherQuery, timeContext?: TimeContext): Promise<ParsedWeatherQuery> {
    const startTime = Date.now();
    
    // Step 1: Rule-based parsing for common patterns
    const ruleResult = this.parseWithRules(query);
    
    // Step 2: Dynamic confidence threshold based on AI availability
    const aiThreshold = this.geminiParser ? this.config.aiThreshold : this.config.minConfidenceThreshold;
    
    // Step 3: Check if AI fallback is needed
    if (ruleResult.confidence < aiThreshold && this.geminiParser) {
      try {
        logger.info('Using AI fallback for complex query', { 
          query: query.query, 
          ruleConfidence: ruleResult.confidence,
          threshold: aiThreshold 
        });
        
        const aiResult = await this.geminiParser.parseQuery({ 
          query: query.query,
          context: query.context || (timeContext ? `Current time: ${timeContext.currentTime.toISOString()}, timezone: ${timeContext.timezone}` : undefined)
        });
        
        if (aiResult.success && aiResult.result) {
          // Merge AI result with rule-based structure
          const mergedResult = this.mergeParsingResults(ruleResult, aiResult.result);
          mergedResult.parsingSource = 'rules_with_ai_fallback';
          
          logger.info('AI fallback successful', { 
            originalConfidence: ruleResult.confidence,
            aiConfidence: mergedResult.confidence,
            processingTime: Date.now() - startTime 
          });
          
          return mergedResult;
        }
      } catch (error) {
        logger.warn('AI fallback failed, using rule-based result', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    // Step 4: Return rule-based result (either sufficient confidence or AI unavailable/failed)
    const parsingSource = this.geminiParser ? 
      (ruleResult.confidence >= aiThreshold ? 'rules_only' : 'rules_fallback') :
      'rules_fallback';
    
    return {
      ...ruleResult,
      parsingSource
    };
  }

  /**
   * Rule-based parsing for common patterns (optimized for speed)
   */
  private parseWithRules(query: WeatherQuery): ParsedWeatherQuery {
    const text = query.query.toLowerCase();
    const originalText = query.query;

    // Enhanced location extraction with more patterns
    const locationPatterns = [
      /(?:in|at|for)\s+([^,\n]+?)(?:\s+(?:today|tomorrow|weather|forecast)|$)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:weather|forecast|today|tomorrow)/i,
      /^([^,\n]+?)\s+(?:weather|forecast|今天|明天|天氣)/i,
      /([^,\n]+?)\s*[,，]\s*(?:weather|forecast|天氣)/i
    ];
    
    let location: string | null = null;
    for (const pattern of locationPatterns) {
      const match = originalText.match(pattern);
      if (match && match[1]) {
        location = match[1].trim();
        break;
      }
    }
    
    // Enhanced intent detection with more patterns
    let intent: WeatherIntent = 'current_conditions';
    let intentConfidence = 0.7;
    
    if (text.includes('forecast') || text.includes('tomorrow') || text.includes('明天') || 
        text.includes('next') || text.includes('future') || text.includes('預報')) {
      intent = 'forecast';
      intentConfidence = 0.9;
    } else if (text.includes('yesterday') || text.includes('昨天') || text.includes('前天') ||
               text.includes('last week') || text.includes('上週') || text.includes('historical') ||
               text.includes('past') || text.includes('之前') || text.includes('過去')) {
      intent = 'historical';
      intentConfidence = 0.9;
    } else if (text.includes('surf') || text.includes('wave') || text.includes('衝浪') || 
               text.includes('marine') || text.includes('ocean') || text.includes('sea')) {
      intent = 'marine_conditions';
      intentConfidence = 0.9;
    } else if (text.includes('air quality') || text.includes('pollution') || text.includes('空氣品質')) {
      intent = 'air_quality';
      intentConfidence = 0.9;
    } else if (text.includes('advice') || text.includes('recommend') || text.includes('建議')) {
      intent = 'weather_advice';
      intentConfidence = 0.8;
    }
    
    // Enhanced metrics extraction
    const metrics: WeatherMetric[] = ['temperature'];
    if (text.includes('wind') || text.includes('風') || text.includes('風速') || text.includes('風力')) metrics.push('wind_speed');
    if (text.includes('humidity') || text.includes('濕度') || text.includes('相對濕度')) metrics.push('humidity');
    if (text.includes('rain') || text.includes('precipitation') || text.includes('雨') || text.includes('降雨') || text.includes('降水')) metrics.push('precipitation');
    if (text.includes('pressure') || text.includes('氣壓') || text.includes('大氣壓力')) metrics.push('pressure');
    if (text.includes('uv') || text.includes('紫外線') || text.includes('UV指數')) metrics.push('uv_index');
    if (text.includes('visibility') || text.includes('能見度') || text.includes('視程')) metrics.push('visibility');
    if (text.includes('feels like') || text.includes('體感') || text.includes('感覺溫度')) metrics.push('feels_like');
    
    // Time scope detection
    let timeScope;
    if (intent === 'forecast') {
      timeScope = { type: 'forecast' as const, duration: '7days' };
    } else if (intent === 'historical') {
      timeScope = { type: 'historical' as const, duration: '30days' };
    } else {
      timeScope = { type: 'current' as const };
    }
    
    // Language detection (enhanced for Japanese)
    let language: 'en' | 'zh-TW' | 'ja' = 'en';
    if (/[\u4e00-\u9fff]/.test(originalText)) {
      language = 'zh-TW';
    } else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(originalText)) {
      language = 'ja';
    }
    
    // Improved confidence calculation
    let confidence = 0.4; // Base confidence
    if (location) confidence += 0.3; // Location found
    if (intentConfidence > 0.8) confidence += 0.2; // High intent confidence
    if (metrics.length > 1) confidence += 0.1; // Multiple metrics
    
    return {
      originalQuery: query.query,
      location: {
        name: location,
        confidence: location ? 0.8 : 0.0
      },
      intent: {
        primary: intent,
        confidence: intentConfidence
      },
      timeScope,
      metrics,
      confidence,
      language,
      parsingSource: 'rules_only', // Will be updated by caller
      context: query.context
    };
  }

  /**
   * Merge rule-based result with AI result for best accuracy
   */
  private mergeParsingResults(ruleResult: ParsedWeatherQuery, aiResult: any): ParsedWeatherQuery {
    // Use AI result for location if it has higher confidence
    const location = (aiResult.location?.confidence || 0) > ruleResult.location.confidence 
      ? { name: aiResult.location?.name || null, confidence: aiResult.location?.confidence || 0 }
      : ruleResult.location;
    
    // Use AI result for intent if it has higher confidence  
    const intent = (aiResult.intent?.confidence || 0) > ruleResult.intent.confidence
      ? { primary: aiResult.intent?.primary || ruleResult.intent.primary, confidence: aiResult.intent?.confidence || 0 }
      : ruleResult.intent;
    
    // Merge metrics from both sources
    const metrics = Array.from(new Set([...ruleResult.metrics, ...(aiResult.metrics || [])]));
    
    // Use higher overall confidence
    const confidence = Math.max(ruleResult.confidence, aiResult.confidence || 0);
    
    return {
      ...ruleResult,
      location,
      intent,
      metrics,
      confidence,
      language: aiResult.userPreferences?.language || ruleResult.language
    };
  }
}
