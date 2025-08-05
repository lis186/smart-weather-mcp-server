import { 
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WeatherQuery } from '../types/index.js';
import { logger } from './logger.js';

// Phase 2 imports
import { QueryRouter } from './query-router.js';
import { createWeatherParser } from './gemini-parser.js';
import { WeatherErrorHandler } from '../utils/error-handler.js';

/**
 * Shared tool handler service to avoid code duplication between STDIO and HTTP modes
 * Phase 2: Integrated with Gemini AI parser and intelligent query routing
 */
export class ToolHandlerService {
  private static queryRouter: QueryRouter | null = null;
  private static geminiParser: any = null;
  private static errorHandler = new WeatherErrorHandler();

  /**
   * Initialize Phase 2 components
   */
  private static initializePhase2Components() {
    // Initialize Gemini parser first if project ID is available
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId && !this.geminiParser) {
      try {
        this.geminiParser = createWeatherParser(projectId, {
          minConfidence: 0.3,
          strictMode: false
        });
        logger.info('Phase 2 Gemini Parser initialized', { projectId });
      } catch (error) {
        logger.warn('Gemini Parser initialization failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Initialize QueryRouter with Gemini parser
    if (!this.queryRouter) {
      this.queryRouter = new QueryRouter(this.geminiParser, {
        minConfidenceThreshold: 0.3,
        enableFallbacks: true,
        aiThreshold: 0.50
      });
      logger.info('Phase 2 Query Router initialized');
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
      // Initialize Phase 2 components
      this.initializePhase2Components();
      
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
        
        // Validate context format (should be key-value pairs)
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
          
          // Validate basic key-value structure (loose validation to support Unicode)
          const keyValuePattern = /^[^:]+:[^,]+(,\s*[^:]+:[^,]+)*$/;
          if (!keyValuePattern.test(contextStr)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Context must be in key-value format. Example: "location: 東京, timeframe: 明天"'
            );
          }
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

  // Phase 2 tool handler methods with intelligent parsing and routing
  private static async handleSearchWeather(query: WeatherQuery) {
    if (!this.queryRouter) {
      return this.fallbackResponse('search_weather', query, 'Query router not initialized');
    }

    try {
      // TDD FIX: Check for common issues before routing
      if (query.query.trim().toLowerCase() === 'weather' && !query.context) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ **Weather Search - Missing Information**\n\n` +
                   `**Query:** "${query.query}"\n` +
                   `**Issue:** No location specified\n` +
                   `**Suggestions:** Please specify a location (e.g., "weather in Tokyo", "London weather today")\n\n` +
                   `*Phase 2 intelligent error handling helps users provide better queries.*`
            },
          ],
        };
      }

      // Use Phase 2 query router for intelligent routing
      const routingResult = await this.queryRouter.routeQuery(
        { 
          query: query.query,
          context: query.context  // Pass context as string per PRD
        },
        { 
          apiHealth: { 
            google_current_conditions: { available: true, latency: 200, errorRate: 0.01 },
            google_daily_forecast: { available: true, latency: 300, errorRate: 0.02 },
            google_hourly_forecast: { available: true, latency: 350, errorRate: 0.02 }
          },
          timestamp: new Date()
        }
      );

      // RoutingResult always has parsedQuery and selectedAPI
      const { selectedAPI, parsedQuery, routingDecision } = routingResult;
      const apiConfidence = routingDecision.confidence;
      
      // Use parsing confidence from parsed query
      const parsingConfidence = parsedQuery.confidence || apiConfidence;
      
      // Check parsing source to show AI status
      const parsingSource = parsedQuery.parsingSource || 'unknown';
      let aiStatusMessage = '';
      
      if (parsingSource === 'rules_only' || parsingSource === 'rules_fallback') {
        aiStatusMessage = '\n⚠️ **AI Parser Status:** Gemini AI not available - using simplified rule-based parsing';
      } else if (parsingSource === 'rules_with_ai_fallback') {
        aiStatusMessage = '\n🤖 **AI Parser Status:** Gemini AI enhanced parsing used';
      } else if (parsingSource === 'ai_only') {
        aiStatusMessage = '\n🤖 **AI Parser Status:** AI-powered parsing';
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `🌤️ **Phase 2 Weather Search Results**\n\n` +
                 `**Query Analysis:**\n` +
                 `- Original: "${query.query}"\n` +
                 `- Location: ${parsedQuery.location || 'Not specified'}\n` +
                 `- Intent: ${parsedQuery.intent || 'Unknown'}\n` +
                 `- Language: ${parsedQuery.language || 'en'}\n` +
                 `- Confidence: ${Math.round(parsingConfidence * 100)}%\n\n` +
                 `**Routing Decision:**\n` +
                 `- Selected API: ${selectedAPI}\n` +
                 `- API Confidence: ${Math.round(apiConfidence * 100)}%\n` +
                 `- Reasoning: ${routingDecision.reasoning}\n\n` +
                 `**Weather Metrics:** ${parsedQuery.metrics?.join(', ') || 'temperature, conditions'}${aiStatusMessage}\n\n` +
                 `*Note: This shows Phase 2 intelligent parsing and routing. Weather APIs will be connected in Phase 3.*`
          },
        ],
      };
    } catch (error) {
      logger.error('Search weather routing error', { query: query.query }, error instanceof Error ? error : new Error(String(error)));
      
      // Return fallback response with error details
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ **Weather Search Error**\n\n` +
                 `**Query:** "${query.query}"\n` +
                 `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n` +
                 `**Suggestions:** Try specifying a clear location and weather information type.\n\n` +
                 `*Phase 2 error handling provides helpful guidance.*`
          },
        ],
      };
    }
  }

  private static async handleFindLocation(query: WeatherQuery) {
    try {
      // Use Gemini parser for location parsing if available
      if (this.geminiParser) {
        const parseResult = await this.geminiParser.parseQuery({ query: query.query });
        
        if (parseResult.success && parseResult.result) {
          const { location, intent, confidence, userPreferences } = parseResult.result;
          
          return {
            content: [
              {
                type: 'text',
                text: `📍 **Phase 2 Location Search Results**\n\n` +
                     `**Query Analysis:**\n` +
                     `- Original: "${query.query}"\n` +
                     `- Detected Location: ${location.name || 'Not found'}\n` +
                     `- Coordinates: ${location.coordinates ? `${location.coordinates.lat}, ${location.coordinates.lng}` : 'Not available'}\n` +
                     `- Location Confidence: ${Math.round((location.confidence || 0) * 100)}%\n` +
                     `- Overall Confidence: ${Math.round((intent?.confidence || confidence) * 100)}%\n\n` +
                     `**Intent Classification:**\n` +
                     `- Primary Intent: ${intent.primary}\n` +
                     `- Intent Confidence: ${Math.round(intent.confidence * 100)}%\n\n` +
                     `**Language Detection:**\n` +
                     `- Language: ${userPreferences.language}\n` +
                     `- Units: ${userPreferences.temperatureUnit}\n\n` +
                     `*This demonstrates Phase 2 Gemini AI multilingual location parsing.*`
              },
            ],
          };
        } else {
          const errorMessage = parseResult.error?.message || 'Failed to parse location';
          const suggestions = parseResult.error?.suggestions?.join(', ') || parseResult.error?.suggestedAction || 'Try being more specific with location names';
          
          return {
            content: [
              {
                type: 'text',
                text: `❌ **Location Search - Parsing Issue**\n\n` +
                     `**Query:** "${query.query}"\n` +
                     `**Issue:** ${errorMessage}\n` +
                     `**Suggestions:** ${suggestions}\n\n` +
                     `*This shows Phase 2 error handling with helpful suggestions.*`
              },
            ],
          };
        }
      } else {
        // Fallback without Gemini parser
        return {
          content: [
            {
              type: 'text',
              text: `📍 **Phase 2 Location Search (Basic Mode)**\n\n` +
                   `**Query:** "${query.query}"\n` +
                   `**Status:** Gemini AI parser not available (requires GOOGLE_CLOUD_PROJECT)\n` +
                   `**Fallback:** Basic location extraction would be performed here\n\n` +
                   `*To see full Phase 2 capabilities, configure Google Cloud Project ID.*`
            },
          ],
        };
      }
    } catch (error) {
      logger.error('Find location error', { query: query.query }, error instanceof Error ? error : new Error(String(error)));
      return this.fallbackResponse('find_location', query, error instanceof Error ? error.message : String(error));
    }
  }

  private static async handleGetWeatherAdvice(query: WeatherQuery) {
    if (!this.queryRouter) {
      return this.fallbackResponse('get_weather_advice', query, 'Query router not initialized');
    }

    try {
      // Use Phase 2 query router with advice-specific context
      const routingResult = await this.queryRouter.routeQuery(
        { 
          query: query.query,
          context: query.context
        },
        { 
          apiHealth: { 
            google_current_conditions: { available: true, latency: 200, errorRate: 0.01 }
          },
          timestamp: new Date()
        }
      );

      const { parsedQuery, routingDecision } = routingResult;
      const confidence = routingDecision.confidence;
      
      return {
        content: [
          {
            type: 'text',
            text: `💡 **Phase 2 Weather Advice**\n\n` +
                 `**Query Analysis:**\n` +
                 `- Original: "${query.query}"\n` +
                 `- Intent: ${parsedQuery.intent || 'WEATHER_ADVICE'}\n` +
                 `- Location: ${parsedQuery.location || 'Not specified'}\n` +
                 `- Language: ${parsedQuery.language || 'en'}\n` +
                 `- Confidence: ${Math.round(parsedQuery.confidence * 100)}%\n\n` +
                 `**Weather Focus:**\n` +
                 `- Metrics: ${parsedQuery.metrics?.join(', ') || 'general conditions'}\n` +
                 `- Time Scope: ${parsedQuery.timeScope?.type || 'current'}\n\n` +
                 `**Context Information:** ${query.context || 'No additional context provided'}\n\n` +
                 `*Phase 2 demonstrates intelligent advice parsing. Weather data integration comes in Phase 3.*`
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
}