/**
 * Google Maps Platform Weather API Types
 * Based on Google Weather API documentation
 */

// Core location types
export interface Location {
  latitude: number;
  longitude: number;
  name?: string;
  country?: string;
  region?: string;
}

export interface LocationQuery {
  query: string;
  bias?: {
    latitude: number;
    longitude: number;
    radius?: number;
  };
  language?: string;
}

// Weather data types
export interface WeatherCondition {
  temperature: {
    celsius: number;
    fahrenheit: number;
  };
  humidity: number;
  windSpeed: {
    metersPerSecond: number;
    kilometersPerHour: number;
  };
  windDirection: number;
  pressure: number;
  visibility: number;
  uvIndex?: number;
  description: string;
  iconCode: string;
}

export interface CurrentWeatherData extends WeatherCondition {
  location: Location;
  timestamp: string;
  sunrise?: string;
  sunset?: string;
}

export interface ForecastPeriod extends WeatherCondition {
  time: string;
  precipitationProbability: number;
  precipitationAmount?: number;
}

export interface DailyForecast {
  date: string;
  location: Location;
  conditions: {
    morning: WeatherCondition;
    afternoon: WeatherCondition;
    evening: WeatherCondition;
    night: WeatherCondition;
  };
  summary: {
    high: number;
    low: number;
    precipitationChance: number;
    description: string;
  };
}

export interface HourlyForecast {
  location: Location;
  periods: ForecastPeriod[];
}

// API request types
export interface CurrentWeatherRequest {
  location: Location;
  units?: 'metric' | 'imperial';
  language?: string;
}

export interface ForecastRequest {
  location: Location;
  days?: number;
  hours?: number;
  units?: 'metric' | 'imperial';
  language?: string;
}

export interface HistoricalWeatherRequest {
  location: Location;
  startDate: string;
  endDate: string;
  units?: 'metric' | 'imperial';
  language?: string;
}

// API response types
export interface WeatherAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  requestId?: string;
  timestamp: string;
}

export interface GeocodingResult {
  location: Location;
  formattedAddress: string;
  addressComponents: {
    longName: string;
    shortName: string;
    types: string[];
  }[];
  confidence: number;
}

export interface GeocodingResponse {
  results: GeocodingResult[];
  status: string;
}

// API client configuration
export interface WeatherAPIConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  rateLimitDelay?: number;
}

// Error types
export interface WeatherAPIError extends Error {
  code: string;
  status?: number;
  details?: string;
  retryable?: boolean;
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheConfig {
  currentWeatherTTL: number; // 5 minutes
  forecastTTL: number; // 30 minutes  
  historicalTTL: number; // 1 hour
  geocodingTTL: number; // 24 hours
}