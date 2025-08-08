export interface WeatherQuery {
  query: string;
  context?: string;
}

export interface WeatherResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: string;
    retryable?: boolean;
  };
}

export interface ServerConfig {
  port: number;
  host: string;
  environment: 'development' | 'production' | 'test';
  secrets?: {
    geminiApiKey?: string;
    weatherApiKey?: string;
  };
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface MCPListToolsResponse {
  tools: MCPToolDefinition[];
}

export interface MCPCallToolRequest {
  params: {
    name: string;
    arguments: unknown;
  };
}

// Re-export weather API types for easier imports (avoiding conflicts)
export type { 
  Location,
  CurrentWeatherData,
  DailyForecast,
  HourlyForecast,
  WeatherAPIResponse
} from './weather-api.js';

export type { 
  ParsedQuery, 
  ParsingResult, 
  QueryParsingRequest,
  UserPreferences,
  ValidationConfig,
  GeminiConfig,
  ParsingError
} from './parser.js';

export type {
  ParsedWeatherQuery,
  RoutingContext,
  RoutingResult,
  RoutingDecision,
  QueryRouterConfig
} from './routing.js';

export type {
  QueryAnalysis,
  QueryIntent,
  QueryContext,
  QueryComplexity,
  IntelligentQueryConfig,
  QueryProcessingMethod,
  SupportedLanguage,
  LanguageDetectionResult,
  LocationExtractionResult
} from './intelligent-query.js';

// Export enums
export { IntentType } from './parser.js';