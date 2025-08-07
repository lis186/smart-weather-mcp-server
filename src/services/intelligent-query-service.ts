/**
 * Intelligent Query Service
 * 
 * Replaces complex regex-based parsing with AI and API intelligence
 * Provides unified query understanding and location resolution
 */

import { logger } from './logger.js';
import { LocationService } from './location-service.js';
import { GeminiWeatherParser } from './gemini-parser.js';
import type { 
  WeatherQuery,
  Location,
  WeatherAPIResponse
} from '../types/index.js';
import type { WeatherAPIConfig } from '../types/weather-api.js';

export interface QueryAnalysis {
  /** Original query text */
  originalQuery: string;
  
  /** Query complexity classification */
  complexity: 'simple' | 'moderate' | 'complex';
  
  /** Confidence in the analysis (0-1) */
  confidence: number;
  
  /** Resolved location information */
  location: Location | null;
  
  /** Query intent classification */
  intent: {
    type: 'current_weather' | 'forecast' | 'historical' | 'advice';
    timeframe?: string;
    confidence: number;
  };
  
  /** Language detected */
  language: string;
  
  /** Processing method used */
  method: 'direct_geocoding' | 'ai_parsing' | 'hybrid';
  
  /** Additional context extracted */
  context: {
    activity?: string;
    preferences?: string[];
    temporalRef?: string;
  };
}

export class IntelligentQueryService {
  private readonly locationService: LocationService;
  private readonly geminiParser?: GeminiWeatherParser;
  
  // Simple patterns for quick classification - VERY restrictive to avoid temporal/question patterns
  private readonly simplePatterns = [
    // Exact city + weather format only (no extra words, no questions)
    /^([A-Za-z\u4e00-\u9fff]+(?:\s+[A-Za-z\u4e00-\u9fff]+)?)\s+(?:weather|天氣|날씨|天気)$/i,
    // Weather in city format only (no extra words)
    /^(?:weather|天氣|날씨|天気)\s+(?:in|at|在)\s+([A-Za-z\u4e00-\u9fff]+(?:\s+[A-Za-z\u4e00-\u9fff]+)?)$/i,
    // Single city name only (no weather keywords, very basic)
    /^[A-Za-z\u4e00-\u9fff]{3,}(?:\s+[A-Za-z\u4e00-\u9fff]+)?$/
  ];
  
  // Words that immediately disqualify a query from being simple
  private readonly complexityExclusions = [
    'what', 'how', 'when', 'where', 'will', 'be', 'like', 'tomorrow', 'yesterday', 'next', 'last', '?',
    '什麼', '怎麼', '如何', '將', '會', '明天', '昨天', '下', '上', '？'
  ];

  constructor(config: WeatherAPIConfig, geminiParser?: GeminiWeatherParser) {
    this.locationService = new LocationService(config);
    this.geminiParser = geminiParser;
    
    logger.info('Intelligent Query Service initialized', {
      hasGeminiAI: !!this.geminiParser,
      supportedMethods: this.geminiParser ? 
        ['direct_geocoding', 'ai_parsing', 'hybrid'] : 
        ['direct_geocoding']
    });
  }

  /**
   * Analyze query with intelligent routing
   */
  async analyzeQuery(query: WeatherQuery): Promise<WeatherAPIResponse<QueryAnalysis>> {
    try {
      const startTime = Date.now();
      
      logger.info('Starting intelligent query analysis', {
        query: query.query,
        hasContext: !!query.context
      });

      // Step 1: Classify query complexity
      const complexity = this.classifyComplexity(query.query);
      
      // Step 2: Route to appropriate parsing method
      let analysis: QueryAnalysis;
      
      if (complexity === 'simple') {
        analysis = await this.parseWithDirectGeocoding(query);
      } else if (this.geminiParser && complexity === 'complex') {
        analysis = await this.parseWithAI(query);
      } else {
        analysis = await this.parseWithHybrid(query);
      }
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Query analysis completed', {
        complexity,
        method: analysis.method,
        confidence: analysis.confidence,
        hasLocation: !!analysis.location,
        language: analysis.language,
        processingTime: `${processingTime}ms`
      });

      return {
        success: true,
        data: analysis,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('Query analysis failed', {
        query: query.query,
        error: error.message
      });

      return {
        success: false,
        error: {
          code: 'QUERY_ANALYSIS_FAILED',
          message: 'Failed to analyze query',
          details: error.message
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Classify query complexity for routing
   */
  private classifyComplexity(query: string): 'simple' | 'moderate' | 'complex' {
    const text = query.trim().toLowerCase();
    
    // First check: if query contains exclusion words, it's NOT simple
    const hasExclusions = this.complexityExclusions.some(exclusion => {
      return text.includes(exclusion.toLowerCase());
    });
    
    if (hasExclusions) {
      // Further classify as complex or moderate
      const complexIndicators = [
        'good for', 'suitable for', 'recommend', 'should i', 'can i',
        'outdoor', 'activities', 'wedding', 'picnic', 'running',
        'weekend', 'this week', 'next month', 'compare',
        '適合', '建議', '推薦', '戶外', '活動', '週末', '比較'
      ];
      
      const isComplex = complexIndicators.some(indicator => text.includes(indicator));
      return isComplex ? 'complex' : 'moderate';
    }
    
    // Only now check simple patterns for very basic queries
    const matchesSimple = this.simplePatterns.some(pattern => pattern.test(query));
    
    if (matchesSimple) {
      return 'simple';
    }
    
    // If no patterns match and no exclusions, default to moderate
    return 'moderate';
  }

  /**
   * Direct geocoding approach for simple queries
   */
  private async parseWithDirectGeocoding(query: WeatherQuery): Promise<QueryAnalysis> {
    logger.debug('Using direct geocoding approach', { query: query.query });
    
    // Extract potential location from simple patterns
    let locationText = query.query;
    for (const pattern of this.simplePatterns) {
      const match = query.query.match(pattern);
      if (match && match[1]) {
        locationText = match[1].trim();
        break;
      }
    }
    
    // Try Google Maps direct geocoding
    const locationResult = await this.locationService.searchLocations(locationText);
    
    // Get the actual complexity from classification (don't hardcode as 'simple')
    const actualComplexity = this.classifyComplexity(query.query);
    
    return {
      originalQuery: query.query,
      complexity: actualComplexity,
      confidence: locationResult.success ? 0.9 : 0.3,
      location: locationResult.success ? locationResult.data!.location : null,
      intent: {
        type: this.detectIntent(query.query),
        confidence: 0.8
      },
      language: this.detectLanguage(query.query),
      method: 'direct_geocoding',
      context: {}
    };
  }

  /**
   * AI-powered parsing for complex queries
   */
  private async parseWithAI(query: WeatherQuery): Promise<QueryAnalysis> {
    if (!this.geminiParser) {
      throw new Error('Gemini AI not available for complex query parsing');
    }
    
    logger.debug('Using AI parsing approach', { query: query.query });
    
    const aiResult = await this.geminiParser.parseQuery({
      query: query.query,
      context: query.context
    });

    if (!aiResult.success || !aiResult.result) {
      throw new Error(`AI parsing failed: ${aiResult.error?.message}`);
    }

    const parsed = aiResult.result;
    
    // Try to resolve location if AI found one
    let resolvedLocation: Location | null = null;
    if (parsed.location?.name) {
      const locationResult = await this.locationService.searchLocations(parsed.location.name);
      if (locationResult.success) {
        resolvedLocation = locationResult.data!.location;
      }
    }

    return {
      originalQuery: query.query,
      complexity: 'complex',
      confidence: parsed.confidence || 0.7,
      location: resolvedLocation,
      intent: {
        type: this.mapAIIntent(parsed.intent?.primary || 'current_conditions'),
        timeframe: parsed.timeScope?.type,
        confidence: parsed.intent?.confidence || 0.7
      },
      language: this.detectLanguage(query.query),
      method: 'ai_parsing',
      context: {
        activity: this.extractActivity(query.query),
        temporalRef: parsed.timeScope?.type
      }
    };
  }

  /**
   * Hybrid approach combining both methods
   */
  private async parseWithHybrid(query: WeatherQuery): Promise<QueryAnalysis> {
    logger.debug('Using hybrid approach', { query: query.query });
    
    // Try direct geocoding first
    const directResult = await this.parseWithDirectGeocoding(query);
    
    // If confidence is high enough, use direct result
    if (directResult.confidence >= 0.7) {
      directResult.method = 'hybrid';
      return directResult;
    }
    
    // Otherwise, try AI if available
    if (this.geminiParser) {
      try {
        const aiResult = await this.parseWithAI(query);
        aiResult.method = 'hybrid';
        return aiResult;
      } catch (error) {
        logger.warn('AI parsing failed in hybrid mode, using direct result', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Fall back to direct result
    directResult.method = 'hybrid';
    return directResult;
  }

  /**
   * Detect query intent from text patterns
   */
  private detectIntent(query: string): 'current_weather' | 'forecast' | 'historical' | 'advice' {
    const text = query.toLowerCase();
    
    // Forecast indicators - expanded to catch more patterns
    if (text.includes('forecast') || text.includes('tomorrow') || text.includes('next') || 
        text.includes('will be') || text.includes('going to be') || text.includes('later') ||
        text.includes('預報') || text.includes('明天') || text.includes('下') || 
        text.includes('將') || text.includes('會')) {
      return 'forecast';
    }
    
    // Historical indicators  
    if (text.includes('yesterday') || text.includes('last') || text.includes('past') ||
        text.includes('昨天') || text.includes('過去') || text.includes('上')) {
      return 'historical';
    }
    
    // Advice indicators
    if (text.includes('recommend') || text.includes('advice') || text.includes('good for') || 
        text.includes('should') || text.includes('建議') || text.includes('適合')) {
      return 'advice';
    }
    
    return 'current_weather';
  }

  /**
   * Detect query language
   */
  private detectLanguage(query: string): string {
    if (/[\u4e00-\u9fff]/.test(query)) return 'zh';
    if (/[\u3040-\u30ff]/.test(query)) return 'ja';
    if (/[\uac00-\ud7af]/.test(query)) return 'ko';
    if (/[\u0600-\u06ff]/.test(query)) return 'ar';
    if (/[\u0900-\u097f]/.test(query)) return 'hi';
    if (/[àáâäèéêëìíîïòóôöùúûü]/.test(query.toLowerCase())) return 'fr';
    if (/[äöüß]/.test(query.toLowerCase())) return 'de';
    if (/[ñáéíóúü]/.test(query.toLowerCase())) return 'es';
    
    return 'en'; // Default to English
  }

  /**
   * Map AI intent types to our intent system
   */
  private mapAIIntent(aiIntent: string): 'current_weather' | 'forecast' | 'historical' | 'advice' {
    const mapping: { [key: string]: 'current_weather' | 'forecast' | 'historical' | 'advice' } = {
      'current_conditions': 'current_weather',
      'forecast': 'forecast',
      'historical': 'historical',
      'weather_advice': 'advice'
    };
    
    return mapping[aiIntent] || 'current_weather';
  }

  /**
   * Extract activity context from query
   */
  private extractActivity(query: string): string | undefined {
    const activities = [
      'wedding', 'picnic', 'running', 'hiking', 'outdoor',
      '婚禮', '野餐', '跑步', '登山', '戶外'
    ];
    
    for (const activity of activities) {
      if (query.toLowerCase().includes(activity.toLowerCase())) {
        return activity;
      }
    }
    
    return undefined;
  }
}