/**
 * Gemini AI Weather Query Parser for Smart Weather MCP Server
 * Parses natural language weather queries using Gemini 2.5 Flash-Lite
 */

import { GeminiClient } from './gemini-client.js';
import { 
  ParsedQuery, 
  ParsingResult, 
  QueryParsingRequest,
  UserPreferences,
  ValidationConfig,
  WeatherMetric,
  IntentType
} from '../types/parser.js';
import { logger } from './logger.js';

interface GeminiParseResponse {
  location: {
    name?: string;
    coordinates?: { lat: number; lng: number; };
    confidence: number;
    suggestions?: string[];
  };
  intent: {
    primary: IntentType;
    secondary?: IntentType[];
    confidence: number;
  };
  timeScope: {
    type: 'current' | 'forecast' | 'historical';
    period?: string;
    startDate?: string;
    endDate?: string;
    confidence: number;
  };
  weatherMetrics: WeatherMetric[];
  userPreferences: {
    language: 'en' | 'zh-TW' | 'zh-CN' | 'ja';
    temperatureUnit: 'celsius' | 'fahrenheit';
    detailLevel: 'basic' | 'detailed' | 'comprehensive';
  };
  confidence: number;
}

export class GeminiWeatherParser {
  private readonly geminiClient: GeminiClient;
  private readonly validation: ValidationConfig;

  constructor(
    geminiClient: GeminiClient,
    validation: Partial<ValidationConfig> = {}
  ) {
    this.geminiClient = geminiClient;
    this.validation = {
      strictMode: validation.strictMode ?? false,
      minConfidence: validation.minConfidence ?? 0.3,
      requireLocation: validation.requireLocation ?? false,
      allowedLanguages: validation.allowedLanguages ?? ['en', 'zh-TW', 'zh-CN', 'ja']
    };
  }

  /**
   * Parse weather query using Gemini AI
   */
  async parseQuery(request: QueryParsingRequest): Promise<ParsingResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      this.validateInput(request);

      // Build parsing prompt
      const prompt = this.buildParsingPrompt(request);
      
      // Get response from Gemini
      const geminiResponse = await this.geminiClient.generateContent(prompt);
      
      // Parse structured response
      const parsedResponse = this.geminiClient.parseStructuredResponse<GeminiParseResponse>(
        geminiResponse.response
      );
      
      // Convert to internal format
      const parsedQuery = this.convertToInternalFormat(request.query, parsedResponse);
      
      // Validate result
      this.validateParsedQuery(parsedQuery);
      
      const result: ParsingResult = {
        success: true,
        result: parsedQuery,
        metadata: {
          processingTime: Date.now() - startTime,
          tokensUsed: geminiResponse.tokensUsed,
          modelUsed: this.geminiClient.getConfig().model
        }
      };

      logger.info('Query parsing successful', {
        query: request.query.substring(0, 100),
        confidence: parsedQuery.confidence,
        intent: parsedQuery.intent.primary,
        location: parsedQuery.location.name,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Query parsing failed', {
        query: request.query.substring(0, 100),
        error: errorMessage,
        processingTime: Date.now() - startTime
      });

      return {
        success: false,
        error: {
          type: 'PARSING_FAILED',
          message: 'Failed to parse weather query',
          details: errorMessage,
          retryable: true,
          suggestions: this.generateErrorSuggestions(request.query, errorMessage)
        },
        metadata: {
          processingTime: Date.now() - startTime,
          modelUsed: this.geminiClient.getConfig().model
        }
      };
    }
  }

  /**
   * Build parsing prompt for Gemini
   */
  private buildParsingPrompt(request: QueryParsingRequest): string {
    const basePrompt = `You are a weather query parser. Parse the following weather query and return a JSON response with the specified structure.

Query: "${request.query}"
Context: ${request.context || 'None'}

Instructions:
1. Extract location information (name, coordinates if obvious like "Tokyo" -> lat: 35.6762, lng: 139.6503)
2. Determine primary intent: CURRENT_WEATHER, WEATHER_FORECAST, HISTORICAL_WEATHER, WEATHER_ADVICE, LOCATION_SEARCH
3. Identify time scope: current, forecast (future), or historical (past)
4. Extract weather metrics mentioned: temperature, humidity, precipitation, wind, pressure, visibility, uv_index, air_quality, conditions, feels_like
5. Determine user preferences: language, temperature unit, detail level
6. Provide confidence score (0.0 to 1.0) for overall parsing quality

Support multiple languages:
- English: "What's the weather like in New York today?"
- Chinese: "明天北京的天氣如何？", "台北今天會下雨嗎？"  
- Japanese: "今日の東京の天気はどうですか？"

Return JSON in this exact format:`;

    const jsonSchema = `
{
  "location": {
    "name": "location name or null",
    "coordinates": { "lat": number, "lng": number } or null,
    "confidence": number between 0-1,
    "suggestions": ["alternative locations"] or null
  },
  "intent": {
    "primary": "CURRENT_WEATHER|WEATHER_FORECAST|HISTORICAL_WEATHER|WEATHER_ADVICE|LOCATION_SEARCH",
    "secondary": ["additional intents"] or null,
    "confidence": number between 0-1
  },
  "timeScope": {
    "type": "current|forecast|historical",
    "period": "description like 'today', 'tomorrow', 'next week'",
    "startDate": "ISO date or null",
    "endDate": "ISO date or null", 
    "confidence": number between 0-1
  },
  "weatherMetrics": ["array of weather metrics mentioned"],
  "userPreferences": {
    "language": "en|zh-TW|zh-CN|ja",
    "temperatureUnit": "celsius|fahrenheit", 
    "detailLevel": "basic|detailed|comprehensive"
  },
  "confidence": number between 0-1
}`;

    return basePrompt + jsonSchema;
  }

  /**
   * Convert Gemini response to internal format
   */
  private convertToInternalFormat(originalQuery: string, response: GeminiParseResponse): ParsedQuery {
    return {
      originalQuery,
      location: response.location,
      intent: response.intent,
      timeScope: response.timeScope,
      weatherMetrics: response.weatherMetrics || ['temperature', 'conditions'],
      userPreferences: {
        language: response.userPreferences.language || 'en',
        temperatureUnit: response.userPreferences.temperatureUnit || 'celsius',
        detailLevel: response.userPreferences.detailLevel || 'basic',
        responseFormat: 'text'
      },
      confidence: response.confidence
    };
  }

  /**
   * Validate input query
   */
  private validateInput(request: QueryParsingRequest): void {
    if (!request.query || typeof request.query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    if (request.query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    if (request.query.length > 1000) {
      throw new Error('Query is too long (maximum 1000 characters)');
    }

    // Check for potential malicious content
    const suspiciousPatterns = [
      /\<script\>/i,
      /javascript:/i,
      /eval\(/i,
      /document\./i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(request.query)) {
        throw new Error('Query contains potentially unsafe content');
      }
    }
  }

  /**
   * Validate parsed query result
   */
  private validateParsedQuery(parsed: ParsedQuery): void {
    if (parsed.confidence < this.validation.minConfidence) {
      throw new Error(`Parsing confidence ${parsed.confidence.toFixed(2)} is below minimum threshold ${this.validation.minConfidence}`);
    }

    if (this.validation.requireLocation && (!parsed.location.name || parsed.location.confidence < 0.5)) {
      throw new Error('Location is required but could not be identified with sufficient confidence');
    }

    if (!this.validation.allowedLanguages.includes(parsed.userPreferences.language)) {
      throw new Error(`Language ${parsed.userPreferences.language} is not supported`);
    }

    if (this.validation.strictMode) {
      // Additional strict validation
      if (parsed.intent.confidence < 0.7) {
        throw new Error('Intent confidence too low for strict mode');
      }

      if (parsed.timeScope.confidence < 0.7) {
        throw new Error('Time scope confidence too low for strict mode');
      }
    }
  }

  /**
   * Generate helpful error suggestions
   */
  private generateErrorSuggestions(query: string, error: string): string[] {
    const suggestions: string[] = [];

    if (error.includes('location')) {
      suggestions.push('Try including a specific city or location name');
      suggestions.push('Use well-known location names like "New York" or "Tokyo"');
    }

    if (error.includes('confidence')) {
      suggestions.push('Be more specific about what weather information you need');
      suggestions.push('Include time information like "today", "tomorrow", or "this week"');
    }

    if (error.includes('language')) {
      suggestions.push('Try asking in English, Chinese (Traditional/Simplified), or Japanese');
    }

    if (query.length < 10) {
      suggestions.push('Provide more detailed information about your weather query');
    }

    if (suggestions.length === 0) {
      suggestions.push('Try rephrasing your question with more specific details');
      suggestions.push('Include location and time information in your query');
    }

    return suggestions;
  }

  /**
   * Update validation configuration
   */
  updateValidation(updates: Partial<ValidationConfig>): void {
    Object.assign(this.validation, updates);
    logger.info('Parser validation configuration updated', { updates });
  }

  /**
   * Get current validation configuration
   */
  getValidationConfig(): ValidationConfig {
    return { ...this.validation };
  }

  /**
   * Test parser with predefined queries
   */
  async testParser(): Promise<{ passed: number; failed: number; results: any[] }> {
    const testQueries = [
      { query: 'What is the weather like in Tokyo today?', expected: { intent: 'CURRENT_WEATHER', location: 'Tokyo' } },
      { query: '明天北京的天氣如何？', expected: { intent: 'WEATHER_FORECAST', location: '北京' } },
      { query: '来週の東京の天気予報を教えて', expected: { intent: 'WEATHER_FORECAST', location: '東京' } },
      { query: 'Should I bring an umbrella today?', expected: { intent: 'WEATHER_ADVICE' } },
      { query: 'Where is the nearest weather station?', expected: { intent: 'LOCATION_SEARCH' } }
    ];

    const results = [];
    let passed = 0;
    let failed = 0;

    for (const test of testQueries) {
      try {
        const result = await this.parseQuery({ query: test.query });
        if (result.success) {
          passed++;
          results.push({ query: test.query, status: 'passed', result: result.result });
        } else {
          failed++;
          results.push({ query: test.query, status: 'failed', error: result.error });
        }
      } catch (error) {
        failed++;
        results.push({ 
          query: test.query, 
          status: 'error', 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    logger.info('Parser test completed', { passed, failed, total: testQueries.length });
    return { passed, failed, results };
  }
}

/**
 * Factory function to create a weather parser with default configuration
 */
export function createWeatherParser(
  projectId: string, 
  config?: Partial<ValidationConfig>
): GeminiWeatherParser {
  const geminiClient = new GeminiClient({ projectId });
  return new GeminiWeatherParser(geminiClient, config);
}