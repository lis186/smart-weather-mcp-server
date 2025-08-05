/**
 * Type definitions for Gemini AI parser system
 * Smart Weather MCP Server - Phase 2.1 Implementation
 */

export interface ParsedQuery {
  originalQuery: string;
  location: LocationInfo;
  intent: WeatherIntent;
  timeScope: TimeScope;
  weatherMetrics: WeatherMetric[];
  userPreferences: UserPreferences;
  confidence: number;
}

export interface LocationInfo {
  name?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  confidence: number;
  suggestions?: string[];
}

export interface WeatherIntent {
  primary: IntentType;
  secondary?: IntentType[];
  confidence: number;
}

export type IntentType = 
  | 'CURRENT_WEATHER'
  | 'WEATHER_FORECAST' 
  | 'HISTORICAL_WEATHER'
  | 'WEATHER_ADVICE'
  | 'LOCATION_SEARCH';

export interface TimeScope {
  type: 'current' | 'forecast' | 'historical';
  period?: string;
  startDate?: string;
  endDate?: string;
  confidence: number;
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
  | 'feels_like';

export interface UserPreferences {
  language: 'en' | 'zh-TW' | 'zh-CN' | 'ja';
  temperatureUnit: 'celsius' | 'fahrenheit';
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
  responseFormat?: 'text' | 'structured';
}

export interface ParsingResult {
  success: boolean;
  result?: ParsedQuery;
  error?: ParsingError;
  metadata: {
    processingTime: number;
    tokensUsed?: number;
    modelUsed: string;
  };
}

export interface ParsingError {
  type: 'INVALID_INPUT' | 'PARSING_FAILED' | 'API_ERROR' | 'TIMEOUT';
  message: string;
  details?: string;
  retryable: boolean;
  suggestions?: string[];
}

export interface GeminiConfig {
  projectId: string;
  region?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface QueryParsingRequest {
  query: string;
  context?: string;
  preferences?: Partial<UserPreferences>;
}

export interface ValidationConfig {
  strictMode: boolean;
  minConfidence: number;
  requireLocation: boolean;
  allowedLanguages: string[];
}