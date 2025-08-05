/**
 * Simplified Query Router for Smart Weather MCP Server
 * Routes weather queries to appropriate Google Weather APIs based on parsed intent
 */

import {
  ParsedWeatherQuery,
  RoutingContext,
  RoutingResult,
  QueryRouterConfig,
  WeatherIntent,
  WeatherMetric
} from '../types/routing.js';
import { WeatherQuery } from '../types/index.js';
import { APISelector } from './api-selector.js';
import { logger } from './logger.js';

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
      aiThreshold: 0.50,
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
      // Parse the query into structured format
      const parsedQuery = this.parseQuery(query);
      
      // Create routing context with defaults
      const routingContext: RoutingContext = context || {
        apiHealth: {},
        timestamp: new Date()
      };

      // Select API using the apiSelector
      const decision = await this.apiSelector.selectAPI(parsedQuery, routingContext);
      
      // Create successful result
      const result: RoutingResult = {
        selectedAPI: decision.selectedAPI,
        parsedQuery,
        apiParameters: {
          endpoint: decision.selectedAPI,
          method: 'GET',
          params: {}
        },
        fallbackAPIs: [],
        routingDecision: {
          confidence: decision.confidence || 0.5,
          reasoning: decision.reasoning || 'Default routing decision',
          alternativeOptions: []
        },
        performance: {
          routingTime: Date.now() - startTime,
          parsingTime: 0,
          totalTime: Date.now() - startTime
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
        selectedAPI: 'error',
        parsedQuery: {
          originalQuery: query.query,
          location: {
            name: null,
            confidence: 0.0
          },
          intent: {
            primary: 'unknown',
            confidence: 0.0
          },
          timeScope: { type: 'current' },
          metrics: ['temperature'],
          confidence: 0,
          language: 'en',
          parsingSource: 'rules_fallback',
          context: query.context
        },
        apiParameters: {
          endpoint: 'error',
          method: 'GET',
          params: {}
        },
        fallbackAPIs: [],
        routingDecision: {
          confidence: 0,
          reasoning: `Error: ${error instanceof Error ? error.message : String(error)}`,
          alternativeOptions: []
        },
        performance: {
          routingTime: Date.now() - startTime,
          parsingTime: 0,
          totalTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Simple query parsing that works with current interfaces
   */
  private parseQuery(query: WeatherQuery): ParsedWeatherQuery {
    const text = query.query.toLowerCase();
    const originalText = query.query;

    // Simple location extraction
    const locationMatch = originalText.match(/in\s+([^,]+)/i) || 
                         originalText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    const location = locationMatch ? locationMatch[1].trim() : null;
    
    // Simple intent detection
    let intent: WeatherIntent = 'current_conditions';
    if (text.includes('forecast') || text.includes('tomorrow') || text.includes('明天')) {
      intent = 'forecast';
    } else if (text.includes('surf') || text.includes('wave') || text.includes('衝浪')) {
      intent = 'marine_conditions';
    }
    
    // Simple metrics extraction
    const metrics: WeatherMetric[] = ['temperature'];
    if (text.includes('wind') || text.includes('風')) {
      metrics.push('wind_speed');
    }
    if (text.includes('humidity') || text.includes('濕度')) {
      metrics.push('humidity');
    }
    
    // Time scope
    const timeScope = intent === 'forecast' 
      ? { type: 'forecast' as const, duration: '7days' }
      : { type: 'current' as const };
    
    // Language detection
    const language: 'en' | 'zh-TW' | 'ja' = /[\u4e00-\u9fff]/.test(originalText) ? 'zh-TW' : 'en';
    
    // Basic confidence calculation
    let confidence = 0.4;
    if (location) confidence += 0.3;
    if (intent === 'forecast' || intent === 'marine_conditions') confidence += 0.2;
    
    return {
      originalQuery: query.query,
      location: {
        name: location,
        confidence: location ? 0.8 : 0.0
      },
      intent: {
        primary: intent,
        confidence: intent === 'forecast' || intent === 'marine_conditions' ? 0.9 : 0.7
      },
      timeScope,
      metrics,
      confidence,
      language,
      parsingSource: 'rules_only',
      context: query.context
    };
  }
}
