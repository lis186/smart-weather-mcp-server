import { 
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WeatherQuery } from '../types/index.js';
import { logger } from './logger.js';

// Phase 2+ imports  
import { IntelligentQueryService } from './intelligent-query-service.js';
import { GeminiWeatherParser } from './gemini-parser.js';
import { GeminiClient } from './gemini-client.js';
import { WeatherErrorHandler } from '../utils/error-handler.js';

// Phase 4.1 imports
import { WeatherService } from './weather-service.js';
import { SecretManager } from './secret-manager.js';
import type { WeatherQueryResult } from './weather-service.js';
import type { ParsedWeatherQuery, RoutingDecision } from '../types/routing.js';

// Phase 4.2 imports
import { LocationService } from './location-service.js';
import type { LocationConfirmation } from './location-service.js';
import { GeminiWeatherAdvisor } from './gemini-weather-advisor.js';

/**
 * Shared tool handler service to avoid code duplication between STDIO and HTTP modes
 * Phase 2: Integrated with Gemini AI parser and intelligent query routing
 */
export class ToolHandlerService {
  private static intelligentQueryService: IntelligentQueryService | null = null;
  private static geminiParser: GeminiWeatherParser | null = null;
  private static errorHandler = new WeatherErrorHandler();
  private static weatherService: WeatherService | null = null;
  private static locationService: LocationService | null = null;
  private static weatherAdvisor: GeminiWeatherAdvisor | null = null;

  /**
   * Initialize Phase 2+ components with IntelligentQueryService
   */
  private static initializeIntelligentQueryService() {
    // Initialize Gemini parser first if project ID is available
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId && !this.geminiParser) {
      try {
        const geminiClient = new GeminiClient({ projectId });
        this.geminiParser = new GeminiWeatherParser(geminiClient, {
          minConfidence: 0.3,
          strictMode: false
        });
        logger.info('Phase 2 Gemini Parser initialized', { projectId });
      } catch (error) {
        logger.warn('Gemini Parser initialization failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Initialize IntelligentQueryService
    if (!this.intelligentQueryService) {
      const apiKey = process.env.WEATHER_API_KEY;
      if (!apiKey) {
        logger.warn('WEATHER_API_KEY not found, some functionality may be limited');
        return; // Skip initialization if no API key
      }
      const config = { apiKey };
      this.intelligentQueryService = new IntelligentQueryService(config, this.geminiParser || undefined);
      logger.info('Phase 2+ IntelligentQueryService initialized', {
        hasGeminiAI: !!this.geminiParser,
        hasWeatherApiKey: !!config.apiKey
      });
    }
  }
  
  /**
   * Get the tool definitions for list_tools requests
   */
  static getToolDefinitions() {
    return {
      tools: [
        {
          name: 'search_weather',
          description: '幫助用戶查找任何地點的天氣資訊，智能判斷查詢類型並提供相應的當前、預報或歷史天氣資料',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '用戶的天氣查詢需求（如：台北今天天氣、東京下週預報、紐約上個月天氣）',
              },
              context: {
                type: 'string',
                description: '偏好設定和額外上下文，如溫度單位、語言、詳細程度等（可選）',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'find_location',
          description: '幫助用戶發現和確認地點位置，解決地名模糊、地址不明確的問題，提供準確的地理資訊',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '地點搜尋查詢（如：台北101、新竹科學園區、模糊地址描述）',
              },
              context: {
                type: 'string',
                description: '地理偏好和搜尋限制，如偏好國家地區、返回格式等（可選）',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_weather_advice',
          description: '基於天氣資訊提供個人化建議和行動指導，幫助用戶做出明智的活動決策',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '活動或決策查詢（如：適合出門嗎、該穿什麼衣服、需要帶傘嗎、適合運動嗎）',
              },
              context: {
                type: 'string',
                description: '個人偏好和活動類型，如戶外運動、商務會議、旅遊計畫等（可選）',
              },
            },
            required: ['query'],
          },
        },
      ],
    };
  }

  /**
   * Handle tool execution requests with Phase 2 intelligence
   */
  static async handleToolCall(name: string, args: unknown) {
    try {
      // Initialize Phase 2+ components
      this.initializeIntelligentQueryService();
      
      // Runtime input validation
      const query = this.validateWeatherQuery(args);
      
      // Log tool call for monitoring
      logger.toolCall(name, query.query, query.context);
      
      switch (name) {
        case 'search_weather':
          return await this.handleSearchWeather(query);
        case 'find_location':
          return await this.handleFindLocation(query);
        case 'get_weather_advice':
          return await this.handleGetWeatherAdvice(query);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        logger.warn('Tool call validation error', { toolName: name, error: error.message });
        throw error;
      }
      logger.error('Tool execution error', { toolName: name }, error instanceof Error ? error : new Error(String(error)));
      
      // Fallback error handling
      throw new McpError(
        ErrorCode.InternalError,
        `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate and sanitize weather query input
   */
  private static validateWeatherQuery(args: unknown): WeatherQuery {
    if (!args || typeof args !== 'object') {
      throw new McpError(ErrorCode.InvalidParams, 'Tool arguments must be an object');
    }

    const input = args as Record<string, unknown>;

    // Validate required query field
    if (!input.query || typeof input.query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required and must be a string');
    }

    // Enhanced input sanitization for query
    let sanitizedQuery = String(input.query).trim();
    
    // Remove potential XSS/injection patterns
    sanitizedQuery = sanitizedQuery
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
      .replace(/data:text\/html/gi, ''); // Remove data URLs
    
    // Limit length and check for empty result
    sanitizedQuery = sanitizedQuery.slice(0, 1000);
    if (!sanitizedQuery) {
      throw new McpError(ErrorCode.InvalidParams, 'Query cannot be empty after sanitization');
    }
    
    // Additional validation: prevent extremely long single words (potential DoS)
    // Increased limit to accommodate complex compound words and URLs
    const words = sanitizedQuery.split(/\s+/);
    const maxWordLength = 200; // Increased from 100 to support longer technical terms and URLs
    if (words.some(word => word.length > maxWordLength)) {
      throw new McpError(ErrorCode.InvalidParams, `Query contains words longer than ${maxWordLength} characters`);
    }

    // Validate and sanitize context (must be string per PRD)
    let sanitizedContext: WeatherQuery['context'] = undefined;
    if (input.context) {
      if (typeof input.context === 'string') {
        // Enhanced sanitization for context string
        let contextStr = String(input.context).trim();
        
        // Remove potential XSS/injection patterns from context
        contextStr = contextStr
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .replace(/data:text\/html/gi, '');
        
        // Limit length and validate content
        contextStr = contextStr.slice(0, 500);
        
        // Validate context format (free-form text per MCP design philosophy)
        // Allow Unicode characters for international support (Chinese, Japanese, etc.)
        // Only block obvious injection attempts
        if (contextStr) {
          // Check for dangerous patterns but allow Unicode
          const dangerousPatterns = /<[^>]+>|[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
          if (dangerousPatterns.test(contextStr)) {
            throw new McpError(
              ErrorCode.InvalidParams, 
              'Context contains invalid control characters or HTML tags'
            );
          }
          
                  // Context is free-form text per MCP design philosophy
        // No strict format validation required - allow natural language context
        // Only validate for obvious security issues (already handled above)
        }
        
        sanitizedContext = contextStr || undefined;
      } else {
        // Context must be string per PRD - reject object context
        throw new McpError(
          ErrorCode.InvalidParams, 
          'Context parameter must be a string. Example: "location: Tokyo, timeframe: today"'
        );
      }
    }

    return {
      query: sanitizedQuery,
      context: sanitizedContext
    };
  }

  /**
   * Set up MCP server handlers for both STDIO and HTTP modes
   */
  static setupServerHandlers(server: Server): void {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return this.getToolDefinitions();
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await this.handleToolCall(name, args);
    });
  }

  // Phase 4.1 tool handler with real weather data integration
  private static async handleSearchWeather(query: WeatherQuery) {
    if (!this.intelligentQueryService) {
      return this.fallbackResponse('search_weather', query, 'Intelligent query service not initialized');
    }

    try {
      // Quick validation for very generic queries
      if (query.query.trim().toLowerCase() === 'weather' && !query.context) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ **Weather Search - Missing Information**\n\n` +
                   `**Query:** "${query.query}"\n` +
                   `**Issue:** No location specified\n` +
                   `**Suggestions:** Please specify a location (e.g., "weather in Tokyo", "London weather today")\n\n` +
                   `*Phase 4.1: Real weather data with intelligent query understanding.*`
            },
          ],
        };
      }

      // Use IntelligentQueryService for AI-powered analysis
      const analysisResult = await this.intelligentQueryService.analyzeQuery(query);

      // Check if analysis was successful
      if (!analysisResult.success || !analysisResult.data) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ **Weather Search Error**\n\n` +
                   `**Query:** "${query.query}"\n` +
                   `**Error:** ${analysisResult.error?.message || 'Query analysis failed'}\n` +
                   `**Suggestions:** Try being more specific about location and time\n\n` +
                   `*Phase 4.1: Intelligent query understanding with real weather data.*`
            },
          ],
        };
      }

      const analysis = analysisResult.data;

      // Phase 4.1: Initialize WeatherService for real data
      const weatherService = await this.getWeatherService();
      
      // Prepare weather query request using intelligent analysis
      const locationName = analysis.location?.name;
      
      const weatherRequest = {
        query: locationName ? 
               `${locationName} weather` :     // Use analyzed location
               query.query,                    // Use original query if no location found
        context: query.context,
        location: analysis.location || undefined, // Pass analyzed location
        options: {
          units: 'metric' as const,
          language: analysis.language || 'en', 
          includeHourly: false,
          includeForecast: analysis.intent.type === 'forecast',
          forecastDays: analysis.intent.timeframe ? 7 : 3
        }
      };

      // Phase 4.1: Get real weather data
      const weatherResult = await weatherService.queryWeather(weatherRequest);

      if (!weatherResult.success) {
        let errorText = `⚠️ **Weather Information Not Available**\n\n`;
        errorText += `**Location Query:** "${query.query}"\n`;
        errorText += `**Issue:** ${weatherResult.error?.message || 'Failed to fetch weather data'}\n`;
        
        if (weatherResult.error?.details) {
          errorText += `**Details:** ${weatherResult.error.details}\n`;
        }
        
        // Add enhanced suggestions if available
        if (weatherResult.error?.suggestions && weatherResult.error.suggestions.length > 0) {
          errorText += `\n**💡 Suggestions:**\n`;
          weatherResult.error.suggestions.forEach((suggestion, index) => {
            errorText += `   ${index + 1}. ${suggestion}\n`;
          });
        }
        
        // Add severity indicator
        if (weatherResult.error?.severity) {
          const severityEmoji = {
            'info': 'ℹ️',
            'warning': '⚠️',
            'error': '❌',
            'critical': '🚨'
          }[weatherResult.error.severity];
          errorText += `\n${severityEmoji} **Severity:** ${weatherResult.error.severity.toUpperCase()}\n`;
        }
        
        errorText += `\n*Phase 4.1: Honest Transparency - We clearly communicate service limitations instead of providing misleading data.*`;
        
        return {
          content: [
            {
              type: 'text',
              text: errorText
            },
          ],
        };
      }

      // Format the response with real weather data
      const weatherData = weatherResult.data!;
      const response = this.formatWeatherResponse(weatherData, analysis);
      
      return {
        content: [
          {
            type: 'text',
            text: response
          },
        ],
      };
    } catch (error) {
      logger.error('Search weather error', { query: query.query }, error instanceof Error ? error : new Error(String(error)));
      
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ **Weather Search Error**\n\n` +
                 `**Query:** "${query.query}"\n` +
                 `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n` +
                 `**Suggestions:** Try specifying a clear location and weather information type.\n\n` +
                 `*Phase 4.1: Error recovery with weather API integration.*`
          },
        ],
      };
    }
  }

  private static async handleFindLocation(query: WeatherQuery) {
    try {
      logger.info('Phase 4.2: Find location request', { query: query.query, context: query.context });

      // Initialize location service
      const locationService = await this.getLocationService();
      
      // Extract potential location from query using multiple methods
      let locationCandidates: string[] = [];
      
      // Method 1: Use Gemini parser if available for intelligent extraction
      if (this.geminiParser) {
        try {
          const parseResult = await this.geminiParser.parseQuery({ query: query.query });
          if (parseResult.success && parseResult.result?.location?.name) {
            locationCandidates.push(parseResult.result.location.name);
          }
        } catch (error) {
          logger.warn('Gemini location parsing failed, using fallback', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Method 2: Use LocationService pattern extraction as fallback/supplement
      const extractedLocations = locationService.extractLocationFromText(query.query);
      locationCandidates.push(...extractedLocations);

      // If no candidates found, use the entire query
      if (locationCandidates.length === 0) {
        locationCandidates.push(query.query);
      }

      // Use the most promising candidate (first one from Gemini if available, otherwise first extracted)
      const searchQuery = locationCandidates[0];
      
      // Configure search options based on context
      const searchOptions = this.parseLocationSearchOptions(query.context);
      
      // Perform location search
      const searchResult = await locationService.searchLocations(searchQuery, searchOptions);

      if (!searchResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ **Location Search Failed**\n\n` +
                   `**Query:** "${query.query}"\n` +
                   `**Issue:** ${searchResult.error?.message || 'Unknown error'}\n` +
                   `**Suggestions:** ${searchResult.error?.details || 'Try being more specific with location names'}\n\n` +
                   `*Phase 4.2: Enhanced location search with Google Maps integration.*`
            },
          ],
        };
      }

      const locationConfirmation = searchResult.data!;
      
      // Format response with both JSON and human-readable content
      const jsonData = {
        location: locationConfirmation.location,
        alternatives: locationConfirmation.alternatives,
        confidence: locationConfirmation.confidence,
        source: locationConfirmation.source,
        needsConfirmation: locationConfirmation.needsConfirmation,
        searchQuery: searchQuery,
        extractedCandidates: locationCandidates
      };

      const textResponse = this.formatLocationResponse(locationConfirmation, query);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(jsonData, null, 2)
          },
          {
            type: 'text',
            text: textResponse
          },
        ],
      };

    } catch (error) {
      logger.error('Find location error', { query: query.query }, error instanceof Error ? error : new Error(String(error)));
      return this.fallbackResponse('find_location', query, error instanceof Error ? error.message : String(error));
    }
  }

  private static async handleGetWeatherAdvice(query: WeatherQuery) {
    try {
      logger.info('Phase 4.2: Weather advice request', { query: query.query, context: query.context });

      // Initialize services
      if (!this.intelligentQueryService) {
        this.initializeIntelligentQueryService();
      }

      // Initialize weather advisor
      const weatherAdvisor = this.getWeatherAdvisor();

      // Step 1: Analyze the query to understand intent and location
      let weatherData: WeatherQueryResult | undefined;
      let analysisResult;

      if (this.intelligentQueryService) {
        try {
          analysisResult = await this.intelligentQueryService.analyzeQuery(query);
          
          if (analysisResult.success && analysisResult.data?.location?.name) {
            // Step 2: Get weather data for the location
            const weatherService = await this.getWeatherService();
            const weatherRequest = {
              query: `${analysisResult.data.location.name} weather`,
              context: query.context,
              location: analysisResult.data.location,
              options: {
                units: 'metric' as const,
                language: analysisResult.data.language || 'en',
                includeHourly: true,
                includeForecast: true,
                forecastDays: 3
              }
            };

            const weatherResult = await weatherService.queryWeather(weatherRequest);
            if (weatherResult.success) {
              weatherData = weatherResult.data;
            }
          }
        } catch (error) {
          logger.warn('Failed to get weather data for advice', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Step 3: Generate advice using Gemini AI or rule-based fallback
      const adviceRequest = {
        query: query.query,
        context: query.context,
        weatherData,
        language: analysisResult?.data?.language || 'en'
      };

      const adviceResult = await weatherAdvisor.generateAdvice(adviceRequest);

      if (!adviceResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ **Weather Advice Error**\n\n` +
                   `**Query:** "${query.query}"\n` +
                   `**Issue:** ${adviceResult.error?.message || 'Failed to generate advice'}\n` +
                   `**Suggestions:** Try being more specific about your activity or location\n\n` +
                   `*Phase 4.2: AI-powered weather advice with intelligent fallbacks.*`
            },
          ],
        };
      }

      // Format response with both JSON and human-readable content
      const advice = adviceResult.advice!;
      const jsonData = {
        advice: advice,
        weatherData: weatherData ? {
          location: weatherData.location,
          current: weatherData.current,
          hasForcast: !!weatherData.daily
        } : null,
        source: adviceResult.source,
        query: query.query,
        context: query.context
      };

      const textResponse = this.formatWeatherAdviceResponse(advice, adviceResult.source, query, weatherData);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(jsonData, null, 2)
          },
          {
            type: 'text',
            text: textResponse
          },
        ],
      };

    } catch (error) {
      logger.error('Weather advice error', { query: query.query }, error instanceof Error ? error : new Error(String(error)));
      return this.fallbackResponse('get_weather_advice', query, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Fallback response for when Phase 2 components fail
   */
  private static fallbackResponse(toolName: string, query: WeatherQuery, errorDetails: string) {
    return {
      content: [
        {
          type: 'text',
          text: `🔧 **${toolName} - Fallback Mode**\n\n` +
               `**Query:** "${query.query}"\n` +
               `**Context:** ${query.context || 'None'}\n` +
               `**Issue:** ${errorDetails}\n\n` +
               `*Phase 2 components encountered an issue. This fallback ensures the tool still responds.*`
        },
      ],
    };
  }

  /**
   * Phase 4.1: Get or initialize WeatherService
   */
  private static async getWeatherService(): Promise<WeatherService> {
    if (!this.weatherService) {
      const secretManager = new SecretManager();
      this.weatherService = new WeatherService({
        secretManager,
        cache: {
          enabled: true,
          config: {
            defaultTTL: 300000, // 5 minutes
            currentWeatherTTL: 300000,
            forecastTTL: 1800000,
            historicalTTL: 86400000,
            locationTTL: 604800000
          }
        },
        apiLimits: {
          maxRequestsPerMinute: 60,
          maxConcurrentRequests: 10
        }
      });
      logger.info('Phase 4.1: WeatherService initialized');
    }
    return this.weatherService;
  }

  /**
   * Phase 4.2: Get or initialize LocationService
   */
  private static async getLocationService(): Promise<LocationService> {
    if (!this.locationService) {
      const secretManager = new SecretManager();
      const apiKey = await secretManager.getSecret('GOOGLE_MAPS_API_KEY');
      
      const finalApiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.WEATHER_API_KEY;
      
      if (!finalApiKey) {
        throw new Error('Google Maps API key not found. Please set GOOGLE_MAPS_API_KEY environment variable or configure Secret Manager.');
      }
      
      this.locationService = new LocationService({
        apiKey: finalApiKey
      });
      logger.info('Phase 4.2: LocationService initialized', {
        hasApiKey: !!finalApiKey,
        source: apiKey ? 'SecretManager' : 'Environment'
      });
    }
    return this.locationService;
  }

  /**
   * Phase 4.2: Get or initialize GeminiWeatherAdvisor
   */
  private static getWeatherAdvisor(): GeminiWeatherAdvisor {
    if (!this.weatherAdvisor) {
      if (this.geminiParser) {
        // Use existing Gemini client from parser
        const geminiClient = (this.geminiParser as any).geminiClient;
        this.weatherAdvisor = new GeminiWeatherAdvisor(geminiClient);
        logger.info('Phase 4.2: GeminiWeatherAdvisor initialized with existing client');
      } else {
        // Try to create new Gemini client
        const projectId = process.env.GOOGLE_CLOUD_PROJECT;
        if (projectId) {
          try {
            const geminiClient = new GeminiClient({ projectId });
            this.weatherAdvisor = new GeminiWeatherAdvisor(geminiClient);
            logger.info('Phase 4.2: GeminiWeatherAdvisor initialized with new client');
          } catch (error) {
            logger.warn('Failed to initialize Gemini client for advisor', { error: error instanceof Error ? error.message : String(error) });
            // Create a mock advisor that will use rule-based fallback
            this.weatherAdvisor = new GeminiWeatherAdvisor(null as any);
          }
        } else {
          // Create a mock advisor that will use rule-based fallback
          this.weatherAdvisor = new GeminiWeatherAdvisor(null as any);
          logger.info('Phase 4.2: GeminiWeatherAdvisor initialized in fallback mode');
        }
      }
    }
    return this.weatherAdvisor;
  }

  /**
   * Phase 4.1: Format weather response with real data
   */
  private static formatWeatherResponse(
    data: WeatherQueryResult,
    analysis: any
  ): string {
    let response = `🌤️ **Weather Search Results**\n\n`;
    
    // Location information
    response += `📍 **Location:** ${data.location.name || 'Unknown'}\n`;
    if (data.location.region || data.location.country) {
      response += `   ${data.location.region ? data.location.region + ', ' : ''}${data.location.country || ''}\n`;
    }
    response += `   Coordinates: ${data.location.latitude.toFixed(4)}°, ${data.location.longitude.toFixed(4)}°\n\n`;

    // Current weather conditions
    if (data.current) {
      const curr = data.current;
      // Use metric by default since we don't have userPreferences in ParsedWeatherQuery
      const temp = `${this.getTemperature(curr.temperature).toFixed(1)}°C`;
      
      response += `🌡️ **Current Conditions:**\n`;
      response += `   Temperature: ${temp}\n`;
      response += `   Description: ${curr.description}\n`;
      response += `   Humidity: ${curr.humidity.toFixed(0)}%\n`;
      response += `   Wind: ${curr.windSpeed.kilometersPerHour.toFixed(1)} km/h`;
      if (curr.windDirection) {
        response += ` (${this.getWindDirection(curr.windDirection)})`;
      }
      response += `\n`;
      response += `   Pressure: ${curr.pressure.toFixed(0)} hPa\n`;
      if (curr.uvIndex !== undefined) {
        response += `   UV Index: ${curr.uvIndex} ${this.getUVDescription(curr.uvIndex)}\n`;
      }
      if (curr.visibility) {
        response += `   Visibility: ${(curr.visibility / 1000).toFixed(1)} km\n`;
      }
      response += '\n';
    }

    // Forecast information
    if (data.daily && data.daily.length > 0) {
      response += `📅 **Forecast (Next ${data.daily.length} Days):**\n`;
      data.daily.slice(0, 5).forEach(day => {
        const date = new Date(day.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        // Use metric by default
        const highTemp = `${day.summary.high.toFixed(0)}°C`;
        const lowTemp = `${day.summary.low.toFixed(0)}°C`;
        
        response += `   ${dayName} ${dateStr}: ${highTemp}/${lowTemp}, ${day.summary.description}`;
        if (day.summary.precipitationChance > 0) {
          response += ` (${day.summary.precipitationChance}% rain)`;
        }
        response += '\n';
      });
      response += '\n';
    }

    // Hourly forecast (if available, show first 6 hours)
    if (data.hourly && data.hourly.periods && data.hourly.periods.length > 0) {
      response += `⏰ **Hourly Forecast (Next 6 Hours):**\n`;
      data.hourly.periods.slice(0, 6).forEach(hour => {
        const time = new Date(hour.time);
        const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        
        // Use metric by default
        const temp = `${this.getTemperature(hour.temperature).toFixed(0)}°C`;
        
        response += `   ${timeStr}: ${temp}, ${hour.description}`;
        if (hour.precipitationProbability && hour.precipitationProbability > 0) {
          response += ` (${hour.precipitationProbability}% rain)`;
        }
        response += '\n';
      });
      response += '\n';
    }

    // Metadata
    response += `ℹ️ **Query Information:**\n`;
    response += `   Intent: ${analysis?.intent?.type || 'current_weather'}\n`;
    response += `   Language: ${analysis?.language || 'en'}\n`;
    response += `   Confidence: ${Math.round((analysis?.confidence || 0) * 100)}%\n`;
    response += `   Data Source: ${data.metadata.cached ? 'Cached' : 'Live'}\n`;
    response += `   Processing: Intelligent Query Analysis\n`;
    
    // Add parsing source info
    const parsingSource = analysis?.method || 'intelligent';
    if (parsingSource === 'rules_fallback') {
      response += `   Parser: Rule-based (Gemini unavailable)\n`;
    } else if (parsingSource === 'rules_only') {
      response += `   Parser: Rule-based (High confidence)\n`;
    } else if (parsingSource === 'rules_with_ai_fallback' || parsingSource === 'ai_only') {
      response += `   Parser: Gemini AI Enhanced\n`;
    }

    response += `\n*Phase 4.1: Real weather data integration completed.*`;
    
    return response;
  }

  /**
   * Helper: Extract temperature value from either real Google API or mock data format
   */
  private static getTemperature(tempData: any, unit: 'celsius' | 'fahrenheit' = 'celsius'): number {
    // Real Google Weather API format: { degrees: 20.7, unit: "CELSIUS" }
    if (tempData && typeof tempData.degrees === 'number') {
      return tempData.degrees;
    }
    
    // Mock data format: { celsius: 20.7, fahrenheit: 69.26 }
    if (tempData && typeof tempData[unit] === 'number') {
      return tempData[unit];
    }
    
    // Fallback to 0 if no valid temperature found
    return 0;
  }

  /**
   * Helper: Convert wind direction degrees to compass direction
   */
  private static getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((degrees % 360) / 22.5));
    return directions[index % 16];
  }

  /**
   * Helper: Get UV index description
   */
  private static getUVDescription(uvIndex: number): string {
    if (uvIndex <= 2) return '(Low)';
    if (uvIndex <= 5) return '(Moderate)';
    if (uvIndex <= 7) return '(High)';
    if (uvIndex <= 10) return '(Very High)';
    return '(Extreme)';
  }

  /**
   * Phase 4.2: Parse location search options from context string
   */
  private static parseLocationSearchOptions(context?: string): any {
    const options: any = {
      maxResults: 5,
      language: 'en',
      strictMode: false
    };

    if (!context) return options;

    // Parse language preference
    if (context.includes('中文') || context.includes('繁體') || context.includes('台灣')) {
      options.language = 'zh-TW';
    } else if (context.includes('日文') || context.includes('日本')) {
      options.language = 'ja';
    } else if (context.includes('英文') || context.includes('English')) {
      options.language = 'en';
    }

    // Parse country bias
    if (context.includes('台灣') || context.includes('Taiwan')) {
      options.countryBias = 'Taiwan';
    } else if (context.includes('日本') || context.includes('Japan')) {
      options.countryBias = 'Japan';
    } else if (context.includes('美國') || context.includes('United States')) {
      options.countryBias = 'United States';
    }

    // Parse strict mode
    if (context.includes('精確') || context.includes('exact') || context.includes('strict')) {
      options.strictMode = true;
    }

    return options;
  }

  /**
   * Phase 4.2: Format location confirmation response
   */
  private static formatLocationResponse(confirmation: LocationConfirmation, query: WeatherQuery): string {
    const { location, confidence, alternatives, source, needsConfirmation } = confirmation;
    
    let response = `📍 **Location Search Results**\n\n`;
    
    // Primary result
    response += `**Found Location:**\n`;
    response += `   Name: ${location.name}\n`;
    if (location.region) response += `   Region: ${location.region}\n`;
    if (location.country) response += `   Country: ${location.country}\n`;
    response += `   Coordinates: ${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°\n`;
    response += `   Confidence: ${Math.round(confidence * 100)}%\n`;
    response += `   Source: ${source}\n\n`;

    // Alternatives if available
    if (alternatives && alternatives.length > 0) {
      response += `**Alternative Locations:**\n`;
      alternatives.forEach((alt, index) => {
        response += `   ${index + 1}. ${alt.name}`;
        if (alt.region || alt.country) {
          response += ` (${alt.region ? alt.region + ', ' : ''}${alt.country || ''})`;
        }
        response += `\n`;
      });
      response += `\n`;
    }

    // Confirmation status
    if (needsConfirmation) {
      response += `⚠️ **Confirmation Recommended**\n`;
      response += `Multiple locations found or confidence below threshold.\n`;
      response += `Please verify this is the correct location before proceeding.\n\n`;
    } else {
      response += `✅ **Location Confirmed**\n`;
      response += `High confidence match - ready to use for weather queries.\n\n`;
    }

    // Query info
    response += `**Query Information:**\n`;
    response += `   Original: "${query.query}"\n`;
    if (query.context) response += `   Context: "${query.context}"\n`;
    response += `   Processing: Intelligent location extraction with Google Maps\n`;
    
    response += `\n*Phase 4.2: Enhanced location search with geocoding and confidence scoring.*`;
    
    return response;
  }

  /**
   * Phase 4.2: Format weather advice response
   */
  private static formatWeatherAdviceResponse(
    advice: any,
    source: string,
    query: WeatherQuery,
    weatherData?: WeatherQueryResult
  ): string {
    let response = `💡 **Weather Advice**\n\n`;

    // Summary
    if (advice.summary) {
      response += `**${advice.summary}**\n\n`;
    }

    // Warnings first (if any)
    if (advice.warnings && advice.warnings.length > 0) {
      response += `⚠️ **Important Warnings:**\n`;
      advice.warnings.forEach((warning: any) => {
        const severityIconMap = {
          'info': 'ℹ️',
          'warning': '⚠️',
          'critical': '🚨'
        } as const;
        const severityIcon = severityIconMap[warning.severity as keyof typeof severityIconMap] || '⚠️';
        response += `   ${severityIcon} ${warning.message}\n`;
      });
      response += `\n`;
    }

    // Recommendations
    if (advice.recommendations && advice.recommendations.length > 0) {
      // Group by priority
      const high = advice.recommendations.filter((r: any) => r.priority === 'high');
      const medium = advice.recommendations.filter((r: any) => r.priority === 'medium');
      const low = advice.recommendations.filter((r: any) => r.priority === 'low');

      if (high.length > 0) {
        response += `🔴 **High Priority:**\n`;
        high.forEach((rec: any) => {
          response += `   ${rec.icon} **${rec.category}**: ${rec.advice}\n`;
        });
        response += `\n`;
      }

      if (medium.length > 0) {
        response += `🟡 **Medium Priority:**\n`;
        medium.forEach((rec: any) => {
          response += `   ${rec.icon} **${rec.category}**: ${rec.advice}\n`;
        });
        response += `\n`;
      }

      if (low.length > 0) {
        response += `🟢 **General Advice:**\n`;
        low.forEach((rec: any) => {
          response += `   ${rec.icon} **${rec.category}**: ${rec.advice}\n`;
        });
        response += `\n`;
      }
    }

    // Weather context (if available)
    if (weatherData?.current) {
      const current = weatherData.current;
      const temp = this.getTemperature(current.temperature);
      
      response += `🌤️ **Current Conditions:**\n`;
      response += `   Location: ${weatherData.location.name}\n`;
      response += `   Temperature: ${temp.toFixed(1)}°C, ${current.description}\n`;
      response += `   Humidity: ${current.humidity.toFixed(0)}%, Wind: ${current.windSpeed.kilometersPerHour.toFixed(1)} km/h\n`;
      if (current.uvIndex !== undefined) {
        response += `   UV Index: ${current.uvIndex} ${this.getUVDescription(current.uvIndex)}\n`;
      }
      response += `\n`;
    }

    // Query info and source
    response += `**Query Information:**\n`;
    response += `   Original: "${query.query}"\n`;
    if (query.context) response += `   Context: "${query.context}"\n`;
    
    // Source information
    if (source === 'gemini_ai') {
      response += `   Processing: Gemini AI Enhanced Advice\n`;
    } else if (source === 'rule_based') {
      response += `   Processing: Rule-based Analysis\n`;
    } else {
      response += `   Processing: Hybrid Analysis\n`;
    }

    response += `\n*Phase 4.2: AI-powered weather advice with actionable recommendations.*`;
    
    return response;
  }
}