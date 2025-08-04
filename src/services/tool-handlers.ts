import { 
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WeatherQuery } from '../types/index.js';

/**
 * Shared tool handler service to avoid code duplication between STDIO and HTTP modes
 */
export class ToolHandlerService {
  
  /**
   * Get the tool definitions for list_tools requests
   */
  static getToolDefinitions() {
    return {
      tools: [
        {
          name: 'search_weather',
          description: 'Search for current weather, forecast, or historical weather data using natural language',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language weather query (e.g., "What\'s the weather like in Tokyo today?", "Will it rain in London tomorrow?")',
              },
              context: {
                type: 'object',
                description: 'Additional context for the weather query',
                properties: {
                  location: {
                    type: 'string',
                    description: 'Specific location if not mentioned in query',
                  },
                  timeframe: {
                    type: 'string',
                    description: 'Time period for the weather data',
                  },
                  preferences: {
                    type: 'object',
                    description: 'User preferences (units, language, etc.)',
                  },
                },
                additionalProperties: true,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'find_location',
          description: 'Find and confirm location details for weather queries',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Location search query (e.g., "Tokyo", "New York", "Paris France")',
              },
              context: {
                type: 'object',
                description: 'Additional context for location search',
                properties: {
                  country: {
                    type: 'string',
                    description: 'Country to narrow down search',
                  },
                  region: {
                    type: 'string',
                    description: 'Region or state to narrow down search',
                  },
                },
                additionalProperties: true,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_weather_advice',
          description: 'Get personalized weather advice and recommendations',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Request for weather advice (e.g., "Should I bring an umbrella?", "What should I wear today?")',
              },
              context: {
                type: 'object',
                description: 'Context for weather advice',
                properties: {
                  location: {
                    type: 'string',
                    description: 'Location for the advice',
                  },
                  activity: {
                    type: 'string',
                    description: 'Planned activity or purpose',
                  },
                  preferences: {
                    type: 'object',
                    description: 'Personal preferences and constraints',
                  },
                },
                additionalProperties: true,
              },
            },
            required: ['query'],
          },
        },
      ],
    };
  }

  /**
   * Handle tool execution requests
   */
  static async handleToolCall(name: string, args: unknown) {
    try {
      const query = args as WeatherQuery;
      
      switch (name) {
        case 'search_weather':
          return this.handleSearchWeather(query);
        case 'find_location':
          return this.handleFindLocation(query);
        case 'get_weather_advice':
          return this.handleGetWeatherAdvice(query);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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

  // Private tool handler methods
  private static handleSearchWeather(query: WeatherQuery) {
    // Phase 1: Basic placeholder implementation
    return {
      content: [
        {
          type: 'text',
          text: `Weather search placeholder - Query: "${query.query}"${query.context ? `, Context: ${JSON.stringify(query.context)}` : ''}`,
        },
      ],
    };
  }

  private static handleFindLocation(query: WeatherQuery) {
    // Phase 1: Basic placeholder implementation
    return {
      content: [
        {
          type: 'text',
          text: `Location search placeholder - Query: "${query.query}"${query.context ? `, Context: ${JSON.stringify(query.context)}` : ''}`,
        },
      ],
    };
  }

  private static handleGetWeatherAdvice(query: WeatherQuery) {
    // Phase 1: Basic placeholder implementation
    return {
      content: [
        {
          type: 'text',
          text: `Weather advice placeholder - Query: "${query.query}"${query.context ? `, Context: ${JSON.stringify(query.context)}` : ''}`,
        },
      ],
    };
  }
}