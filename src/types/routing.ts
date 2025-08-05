/**
 * Query Routing Types for Smart Weather MCP Server
 * Defines types for intelligent query routing and API selection
 */

/**
 * Weather intent classifications
 */
export type WeatherIntent = 
  | 'current_conditions'
  | 'forecast'
  | 'historical'
  | 'air_quality'
  | 'marine_conditions'
  | 'weather_advice'
  | 'location_search'
  | 'unknown';

/**
 * Weather metrics that can be requested
 */
export type WeatherMetric = 
  | 'temperature'
  | 'humidity'
  | 'precipitation'
  | 'wind_speed'
  | 'wind_direction'
  | 'pressure'
  | 'visibility'
  | 'uv_index'
  | 'air_quality'
  | 'wave_height'
  | 'wave_period'
  | 'tide_times'
  | 'pollen_count'
  | 'unknown';

/**
 * Parsed weather query with extracted intent and parameters
 */
export interface ParsedWeatherQuery {
  /** Original query text */
  originalQuery: string;
  
  /** Extracted location with confidence scoring */
  location: {
    name: string | null;
    confidence: number;
  };
  
  /** Classified weather intent with confidence scoring */
  intent: {
    primary: WeatherIntent;
    confidence: number;
  };
  
  /** Time scope for the query */
  timeScope: {
    type: 'current' | 'forecast' | 'historical';
    specificTime?: string;
    duration?: string;
  };
  
  /** Specific weather metrics requested */
  metrics: WeatherMetric[];
  
  /** Activity context (surfing, hiking, etc.) */
  activityContext?: string;
  
  /** Confidence score of the parsing (0-1) */
  confidence: number;
  
  /** Language of the original query */
  language: 'en' | 'zh-TW' | 'ja';
  
  /** Source of parsing (rules, ai, hybrid) */
  parsingSource: 'rules_only' | 'ai_only' | 'rules_with_ai_fallback' | 'rules_fallback';
  
  /** Additional context as optional string (per PRD: all context must be strings) */
  context?: string;
}

/**
 * Context for routing decisions
 */
export interface RoutingContext {
  /** User preferences for units, language */
  userPreferences?: {
    units: 'metric' | 'imperial';
    language: string;
    timezone?: string;
  };
  
  /** API health and availability status */
  apiHealth?: Record<string, {
    available: boolean;
    latency?: number;
    errorRate?: number;
  }>;
  
  /** Request metadata */
  requestId?: string;
  timestamp: Date;
  
  /** Rate limiting info */
  rateLimitInfo?: {
    remaining: number;
    resetTime: Date;
  };
}

/**
 * Result of query routing with selected API and parameters
 */
export interface RoutingResult {
  /** Selected API endpoint */
  selectedAPI: string;
  
  /** Parsed query information */
  parsedQuery: ParsedWeatherQuery;
  
  /** API-specific parameters */
  apiParameters: {
    endpoint: string;
    method: 'GET' | 'POST';
    params: Record<string, unknown>;
    headers?: Record<string, string>;
  };
  
  /** Fallback APIs if primary fails */
  fallbackAPIs: string[];
  
  /** Routing decision metadata */
  routingDecision: {
    confidence: number;
    reasoning: string;
    alternativeOptions: Array<{
      api: string;
      score: number;
      reason: string;
    }>;
  };
  
  /** Caching information */
  cacheInfo?: {
    key: string;
    ttl: number;
    shouldCache: boolean;
  };
  
  /** Performance metrics */
  performance: {
    routingTime: number;
    parsingTime: number;
    totalTime: number;
  };
}

/**
 * Routing error with context
 */
export interface RoutingError {
  code: 'PARSING_FAILED' | 'NO_SUITABLE_API' | 'INVALID_QUERY' | 'TIMEOUT' | 'UNKNOWN';
  message: string;
  originalQuery: string;
  suggestions?: string[];
  context?: Record<string, unknown>;
}

/**
 * Configuration for query router
 */
export interface QueryRouterConfig {
  /** Default language for parsing */
  defaultLanguage: 'en' | 'zh-TW' | 'ja';
  
  /** Default units for weather data */
  defaultUnits: 'metric' | 'imperial';
  
  /** Maximum time to spend on query processing (ms) */
  maxProcessingTime: number;
  
  /** Minimum confidence threshold for accepting parsing results */
  minConfidenceThreshold: number;
  
  /** Threshold for using AI fallback */
  aiThreshold: number;
  
  /** Enable fallback mechanisms */
  enableFallbacks: boolean;
  
  /** API priority order for selection */
  apiPriority: string[];
  
  /** Caching configuration */
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

/**
 * Weather API response structure
 */
export interface WeatherAPIResponse {
  /** Response status */
  status: 'success' | 'error' | 'partial';
  
  /** Weather data */
  data?: {
    location: {
      name: string;
      coordinates: { lat: number; lon: number };
      timezone?: string;
    };
    
    /** Current conditions */
    current?: {
      temperature: number;
      humidity: number;
      pressure: number;
      windSpeed: number;
      windDirection: number;
      visibility: number;
      uvIndex: number;
      conditions: string;
      timestamp: Date;
    };
    
    /** Forecast data */
    forecast?: Array<{
      datetime: Date;
      temperature: { min: number; max: number };
      humidity: number;
      precipitation: { probability: number; amount?: number };
      wind: { speed: number; direction: number };
      conditions: string;
    }>;
    
    /** Air quality data */
    airQuality?: {
      aqi: number;
      pollutants: Record<string, number>;
      healthRecommendations: string[];
    };
    
    /** Marine conditions */
    marine?: {
      waveHeight: number;
      wavePeriod: number;
      waveDirection: number;
      tideInfo?: Array<{
        type: 'high' | 'low';
        time: Date;
        height: number;
      }>;
    };
  };
  
  /** Error information if status is error */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  
  /** Response metadata */
  metadata: {
    source: string;
    timestamp: Date;
    processingTime: number;
    cacheHit?: boolean;
  };
}