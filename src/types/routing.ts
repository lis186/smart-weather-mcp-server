/**
 * Type definitions for intelligent query routing and API selection
 */

export interface ParsedWeatherQuery {
  /** Original user query */
  originalQuery: string;
  
  /** Extracted location information */
  location: {
    name?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    placeId?: string;
    confidence: number;
  };
  
  /** Time-related parameters */
  timeframe: {
    type: 'current' | 'forecast' | 'historical';
    startTime?: Date;
    endTime?: Date;
    duration?: string; // e.g., "3 hours", "2 days"
    confidence: number;
  };
  
  /** Weather data preferences */
  dataPreferences: {
    /** What specific weather data is requested */
    metrics: WeatherMetric[];
    /** Preferred units */
    units?: 'metric' | 'imperial';
    /** Language preference */
    language?: string;
    /** Detail level requested */
    detailLevel: 'basic' | 'detailed' | 'comprehensive';
  };
  
  /** Query intent classification */
  intent: {
    primary: WeatherIntent;
    secondary?: WeatherIntent[];
    confidence: number;
  };
  
  /** Context from user (raw string per PRD) */
  context?: string;
  
  /** Parsing source indication for debugging */
  source?: 'rules' | 'hybrid' | 'rules_fallback' | 'rules_only' | 'error_fallback';
}

export type WeatherMetric = 
  | 'temperature'
  | 'humidity'
  | 'precipitation'
  | 'wind'
  | 'pressure'
  | 'visibility'
  | 'uv_index'
  | 'air_quality'
  | 'conditions'
  | 'feels_like'
  | 'dew_point';

export type WeatherIntent = 
  | 'current_conditions'
  | 'daily_forecast'
  | 'hourly_forecast'
  | 'historical_data'
  | 'location_search'
  | 'weather_advice'
  | 'severe_weather'
  | 'planning_advice';

export interface APIEndpoint {
  /** API endpoint identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** API base URL or path */
  endpoint: string;
  /** API category */
  category: 'weather' | 'geocoding' | 'places';
  /** Supported intents */
  supportedIntents: WeatherIntent[];
  /** Required parameters */
  requiredParams: string[];
  /** Optional parameters */
  optionalParams: string[];
  /** Rate limiting info */
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

export interface RoutingDecision {
  /** Selected API endpoint */
  selectedAPI: APIEndpoint;
  /** Confidence in the routing decision */
  confidence: number;
  /** Parameters to send to the API */
  apiParameters: Record<string, unknown>;
  /** Fallback APIs in order of preference */
  fallbacks: APIEndpoint[];
  /** Reasoning for the decision */
  reasoning: string;
  /** Estimated response time */
  estimatedResponseTime: number;
}

export interface RoutingContext {
  /** Current API health status */
  apiHealth: Record<string, 'healthy' | 'degraded' | 'unavailable'>;
  /** Recent API response times */
  responseTimeHistory: Record<string, number[]>;
  /** Current API usage */
  currentUsage: Record<string, number>;
  /** Cache availability */
  cacheStatus: Record<string, boolean>;
  /** User preferences */
  userPreferences?: {
    preferredAPIs?: string[];
    maxResponseTime?: number;
    qualityOverSpeed?: boolean;
  };
}

export type RoutingError = 
  | 'LOCATION_NOT_FOUND'
  | 'AMBIGUOUS_LOCATION'
  | 'UNSUPPORTED_TIMEFRAME'
  | 'API_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_PARAMETERS'
  | 'PARSING_FAILED'
  | 'NO_SUITABLE_API';

export interface RoutingResult {
  success: boolean;
  decision?: RoutingDecision;
  /** Parsed query data (TDD FIX: Include this!) */
  parsedQuery?: ParsedWeatherQuery;
  error?: {
    type: RoutingError;
    message: string;
    details?: string;
    suggestedAction?: string;
    retryable: boolean;
  };
  /** Alternative suggestions if routing fails */
  alternatives?: RoutingDecision[];
  /** Processing metadata */
  metadata: {
    processingTime: number;
    parsingConfidence: number;
    fallbacksConsidered: number;
    /** Additional metadata for caching and fallbacks */
    cachedAt?: number;
    fallbackUsed?: boolean;
    originalAPI?: string;
  };
}

export interface QueryRouterConfig {
  /** Default language for responses */
  defaultLanguage: string;
  /** Default units */
  defaultUnits: 'metric' | 'imperial';
  /** Maximum processing time for routing */
  maxProcessingTime: number;
  /** Minimum confidence threshold for routing */
  minConfidenceThreshold: number;
  /** AI fallback threshold - if rule confidence is below this, use AI */
  aiThreshold?: number;
  /** Enable fallback mechanisms */
  enableFallbacks: boolean;
  /** API priority order */
  apiPriority: string[];
  /** Caching configuration */
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export interface APIHealthStatus {
  /** API endpoint ID */
  apiId: string;
  /** Current health status */
  status: 'healthy' | 'degraded' | 'unavailable';
  /** Last check timestamp */
  lastCheck: Date;
  /** Average response time */
  avgResponseTime: number;
  /** Success rate in last 100 requests */
  successRate: number;
  /** Error details if unhealthy */
  errorDetails?: string;
}

// Google Weather API specific types
export interface GoogleWeatherAPIConfig {
  /** Current Conditions API */
  currentConditions: APIEndpoint;
  /** Daily Forecast API */
  dailyForecast: APIEndpoint;
  /** Hourly Forecast API */
  hourlyForecast: APIEndpoint;
  /** Hourly History API */
  hourlyHistory: APIEndpoint;
  /** Geocoding API */
  geocoding: APIEndpoint;
  /** Places API */
  places: APIEndpoint;
}

export interface WeatherAPIResponse {
  /** Raw API response */
  rawData: unknown;
  /** Standardized data */
  standardizedData: {
    location: {
      name: string;
      coordinates: { lat: number; lng: number };
      timezone?: string;
    };
    weather: {
      current?: WeatherCondition;
      forecast?: WeatherForecast[];
      historical?: WeatherCondition[];
    };
    metadata: {
      source: string;
      timestamp: Date;
      units: 'metric' | 'imperial';
    };
  };
  /** API-specific metadata */
  apiMetadata: {
    endpoint: string;
    responseTime: number;
    cacheHit: boolean;
    confidence: number;
  };
}

export interface WeatherCondition {
  timestamp: Date;
  temperature: number;
  humidity: number;
  precipitation?: {
    probability: number;
    amount?: number;
    type?: 'rain' | 'snow' | 'mixed';
  };
  wind: {
    speed: number;
    direction: number;
    gust?: number;
  };
  pressure: number;
  visibility: number;
  conditions: string;
  feelsLike?: number;
  uvIndex?: number;
  dewPoint?: number;
}

export interface WeatherForecast extends WeatherCondition {
  /** For daily forecasts */
  high?: number;
  low?: number;
  /** For hourly forecasts */
  hourlyData?: WeatherCondition[];
}