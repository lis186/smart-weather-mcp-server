/**
 * Unified Weather Service
 * Integrates all weather and location APIs into a single service interface
 */

import { GoogleWeatherClient } from './google-weather-client.js';
import { LocationService } from './location-service.js';
import { SecretManager } from './secret-manager.js';
import { logger } from './logger.js';
import { ErrorResponseService } from './error-response-service.js';
import type {
  WeatherAPIConfig,
  WeatherAPIResponse,
  Location,
  CurrentWeatherData,
  DailyForecast,
  HourlyForecast,
  ForecastRequest,
  CurrentWeatherRequest,
  HistoricalWeatherRequest,
  CacheConfig,
  CacheEntry
} from '../types/weather-api.js';
import type { LocationConfirmation, LocationSearchOptions } from './location-service.js';

export interface WeatherServiceConfig {
  secretManager: SecretManager;
  cache?: {
    enabled: boolean;
    config: CacheConfig;
  };
  apiLimits?: {
    maxRequestsPerMinute: number;
    maxConcurrentRequests: number;
  };
}

export interface WeatherQueryRequest {
  query: string;
  context?: string;
  location?: Location;
  options?: {
    units?: 'metric' | 'imperial';
    language?: string;
    includeHourly?: boolean;
    includeForecast?: boolean;
    forecastDays?: number;
  };
}

export interface WeatherQueryResult {
  location: Location;
  current?: CurrentWeatherData;
  daily?: DailyForecast[];
  hourly?: HourlyForecast;
  metadata: {
    sources: string[];
    confidence: number;
    timestamp: string;
    cached: boolean;
  };
}

export class WeatherService {
  private weatherClient?: GoogleWeatherClient;
  private locationService?: LocationService;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly config: WeatherServiceConfig;
  private requestCount = 0;
  private lastResetTime = Date.now();
  
  // Cache performance monitoring
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheEvictions = 0;
  private cacheErrors = 0;

  // Cache configuration constants
  private static readonly MAX_CACHE_SIZE = 10000;
  private static readonly CACHE_CLEANUP_THRESHOLD = 8000;
  private static readonly CACHE_WARNING_THRESHOLD = 7000;
  
  // Time constants (in milliseconds)
  private static readonly CACHE_CLEANUP_INTERVAL = 60000; // 1 minute
  private static readonly DEFAULT_CACHE_TTL = 300000; // 5 minutes
  private static readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  
  // Differentiated TTL strategies
  private static readonly CURRENT_WEATHER_TTL = 300000; // 5 minutes
  private static readonly FORECAST_TTL = 1800000; // 30 minutes
  private static readonly HISTORICAL_TTL = 86400000; // 24 hours
  private static readonly LOCATION_CACHE_TTL = 604800000; // 7 days
  
  // API limits
  private static readonly DEFAULT_MAX_REQUESTS_PER_MINUTE = 60;
  private static readonly DEFAULT_HOURLY_FORECAST_HOURS = 24;
  
  // Mock data constants
  private static readonly MOCK_BASE_TEMPERATURE = 20;
  private static readonly MOCK_TEMP_VARIANCE = 20;
  private static readonly MOCK_HUMIDITY_BASE = 60;
  private static readonly MOCK_HUMIDITY_VARIANCE = 30;

  constructor(config: WeatherServiceConfig) {
    this.config = config;
    // Don't initialize here - will be done explicitly in ensureInitialized()
    
    // Setup cache cleanup interval
    if (config.cache?.enabled) {
      setInterval(() => this.cleanupCache(), WeatherService.CACHE_CLEANUP_INTERVAL);
    }

    logger.info('Weather service constructor completed', {
      cacheEnabled: config.cache?.enabled,
      apiLimitsEnabled: !!config.apiLimits
    });
  }

  /**
   * Ensure services are initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.weatherClient && this.locationService) {
      return; // Already initialized
    }
    
    await this.initializeServices();
  }

  /**
   * Initialize weather and location services
   */
  private async initializeServices(): Promise<void> {
    try {
      // Load API credentials
      const secrets = await this.loadSecrets();
      
      if (secrets.weatherApiKey) {
        const apiConfig: WeatherAPIConfig = {
          apiKey: secrets.weatherApiKey,
          timeout: 5000,
          retryAttempts: 3
        };
        
        this.weatherClient = new GoogleWeatherClient(apiConfig);
        this.locationService = new LocationService(apiConfig);
        
        logger.info('Google Weather APIs initialized successfully');
      } else {
        logger.warn('Weather API key not available - using mock responses');
      }
      
    } catch (error) {
      logger.error('Failed to initialize weather services', { 
        error: (error as Error).message 
      });
    }
  }

  /**
   * Load API secrets
   */
  private async loadSecrets(): Promise<{ weatherApiKey?: string }> {
    try {
      // Try Google Cloud Secret Manager first
      let weatherApiKey = await this.config.secretManager.getSecret(
        'GOOGLE_WEATHER_API_KEY_SECRET'
      ) || await this.config.secretManager.getSecret(
        'GOOGLE_WEATHER_API_KEY'
      );
      
      // Fallback to environment variables for local development
      if (!weatherApiKey) {
        weatherApiKey = process.env.WEATHER_API_KEY || process.env.GOOGLE_WEATHER_API_KEY;
        if (weatherApiKey) {
          logger.info('Using weather API key from environment variables');
        }
      }
      
      logger.info('Weather API key status', { 
        hasSecretManagerKey: !!(await this.config.secretManager.getSecret('GOOGLE_WEATHER_API_KEY_SECRET')),
        hasEnvKey: !!(process.env.WEATHER_API_KEY || process.env.GOOGLE_WEATHER_API_KEY),
        finalKeyAvailable: !!weatherApiKey
      });
      
      return { weatherApiKey };
    } catch (error) {
      logger.error('Failed to load weather API secrets', { 
        error: (error as Error).message 
      });
      
      // Fallback to environment variables even if Secret Manager fails
      const envKey = process.env.WEATHER_API_KEY || process.env.GOOGLE_WEATHER_API_KEY;
      if (envKey) {
        logger.warn('Secret Manager failed, using environment variable fallback');
        return { weatherApiKey: envKey };
      }
      
      return {};
    }
  }

  /**
   * Main weather query method - handles all types of weather requests
   */
  async queryWeather(request: WeatherQueryRequest): Promise<WeatherAPIResponse<WeatherQueryResult>> {
    try {
      // Ensure services are initialized
      await this.ensureInitialized();
      
      // Rate limiting check
      if (!this.checkRateLimit()) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            details: 'API rate limit exceeded'
          },
          timestamp: new Date().toISOString()
        };
      }

      logger.info('Processing weather query', {
        query: request.query,
        hasContext: !!request.context,
        hasLocation: !!request.location
      });

      // Step 1: Resolve location
      const locationResult = await this.resolveLocation(request);
      if (!locationResult.success) {
        return {
          success: false,
          error: locationResult.error,
          timestamp: new Date().toISOString()
        };
      }

      const location = locationResult.data!;
      const cacheKey = this.buildCacheKey(request, location);
      
      // Step 2: Check cache
      if (this.config.cache?.enabled) {
        const cached = this.getFromCache<WeatherQueryResult>(cacheKey);
        if (cached) {
          logger.info('Returning cached weather data', { location: location.name });
          return {
            success: true,
            data: {
              ...cached,
              metadata: {
                ...cached.metadata,
                cached: true
              }
            },
            timestamp: new Date().toISOString()
          };
        }
      }

      // Step 3: Fetch weather data
      const weatherData = await this.fetchWeatherData(location, request.options);
      if (!weatherData.success) {
        return weatherData;
      }

      // Step 4: Cache result
      if (this.config.cache?.enabled) {
        this.setCache(cacheKey, weatherData.data!, this.getCacheTTL(request));
      }

      logger.info('Weather query completed successfully', {
        location: location.name,
        dataTypes: this.getDataTypes(weatherData.data!)
      });

      return weatherData;

    } catch (error) {
      logger.error('Weather query failed', {
        query: request.query,
        error: (error as Error).message
      });

      return {
        success: false,
        error: {
          code: 'WEATHER_QUERY_ERROR',
          message: 'Failed to process weather query',
          details: (error as Error).message
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(location: Location, options?: WeatherQueryRequest['options']): Promise<WeatherAPIResponse<CurrentWeatherData>> {
    // Ensure services are initialized
    await this.ensureInitialized();
    
    // Validate request parameters
    const validationError = this.validateLocation(location);
    if (validationError) {
      const error = new Error(validationError);
      error.name = 'INVALID_LOCATION';
      return ErrorResponseService.createErrorResponse(error, {
        location: location.name,
        language: options?.language
      });
    }
    
    if (!this.weatherClient) {
      logger.warn('WeatherClient not available', {
        hasWeatherClient: !!this.weatherClient,
        location: location.name
      });
      return this.createLocationNotSupportedResponse(location, 'Weather client not initialized');
    }
    
    logger.info('Using real Google Weather API client', {
      location: location.name,
      hasClient: !!this.weatherClient
    });

    const request: CurrentWeatherRequest = {
      location,
      units: options?.units || 'metric',
      language: options?.language || 'en'
    };

    try {
      return await this.weatherClient.getCurrentWeather(request);
    } catch (error: any) {
      // Handle LOCATION_NOT_SUPPORTED error with transparent message
      if (error.name === 'LOCATION_NOT_SUPPORTED') {
        return this.createLocationNotSupportedResponse(location, error.details || error.message);
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get weather forecast for a location
   */
  async getForecast(location: Location, options?: WeatherQueryRequest['options']): Promise<WeatherAPIResponse<DailyForecast[]>> {
    // Ensure services are initialized
    await this.ensureInitialized();
    
    if (!this.weatherClient) {
      return this.createLocationNotSupportedResponse(location, 'Weather client not initialized');
    }

    const request: ForecastRequest = {
      location,
      days: options?.forecastDays || 7,
      units: options?.units || 'metric',
      language: options?.language || 'en'
    };

    try {
      return await this.weatherClient.getDailyForecast(request);
    } catch (error: any) {
      // Handle LOCATION_NOT_SUPPORTED error with transparent message
      if (error.name === 'LOCATION_NOT_SUPPORTED') {
        return this.createLocationNotSupportedResponse(location, error.details || error.message);
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get hourly forecast for a location
   */
  async getHourlyForecast(location: Location, hours: number = 24): Promise<WeatherAPIResponse<HourlyForecast>> {
    if (!this.weatherClient) {
      return this.createLocationNotSupportedResponse(location, 'Weather client not initialized');
    }

    const request: ForecastRequest = {
      location,
      hours,
      units: 'metric',
      language: 'en'
    };

    try {
      return await this.weatherClient.getHourlyForecast(request);
    } catch (error: any) {
      // Handle LOCATION_NOT_SUPPORTED error with transparent message
      if (error.name === 'LOCATION_NOT_SUPPORTED') {
        return this.createLocationNotSupportedResponse(location, error.details || error.message);
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Search for locations
   */
  async searchLocations(query: string, options?: LocationSearchOptions): Promise<WeatherAPIResponse<LocationConfirmation>> {
    // Ensure services are initialized
    await this.ensureInitialized();
    
    if (!this.locationService) {
      return {
        success: false,
        error: {
          code: 'LOCATION_SERVICE_UNAVAILABLE',
          message: 'Location search service is not available',
          details: 'The location search service requires API credentials to function properly'
        },
        timestamp: new Date().toISOString()
      };
    }

    return this.locationService.searchLocations(query, options);
  }

  /**
   * Resolve location from request
   */
  private async resolveLocation(request: WeatherQueryRequest): Promise<WeatherAPIResponse<Location>> {
    // If location is already provided, use it
    if (request.location) {
      return {
        success: true,
        data: request.location,
        timestamp: new Date().toISOString()
      };
    }

    // Extract location from query text
    if (!this.locationService) {
      // Fallback to default location
      return {
        success: true,
        data: {
          latitude: 25.0330,
          longitude: 121.5654,
          name: 'Taipei, Taiwan',
          country: 'Taiwan',
          region: 'Taipei'
        },
        timestamp: new Date().toISOString()
      };
    }

    // Search for location in query text
    const locationCandidates = this.locationService.extractLocationFromText(request.query);
    
    if (locationCandidates.length === 0) {
      return {
        success: false,
        error: {
          code: 'LOCATION_NOT_SPECIFIED',
          message: 'No location found in query',
          details: 'Please specify a location for weather information'
        },
        timestamp: new Date().toISOString()
      };
    }

    // Search for the first location candidate
    const searchResult = await this.locationService.searchLocations(locationCandidates[0]);
    
    if (!searchResult.success) {
      return {
        success: false,
        error: searchResult.error,
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: true,
      data: searchResult.data!.location,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Fetch weather data from APIs
   */
  private async fetchWeatherData(
    location: Location,
    options?: WeatherQueryRequest['options']
  ): Promise<WeatherAPIResponse<WeatherQueryResult>> {
    const sources: string[] = [];
    const result: WeatherQueryResult = {
      location,
      metadata: {
        sources,
        confidence: 0.8,
        timestamp: new Date().toISOString(),
        cached: false
      }
    };

    try {
      // Fetch current weather
      const currentWeather = await this.getCurrentWeather(location, options);
      if (currentWeather.success && currentWeather.data) {
        result.current = currentWeather.data;
        sources.push('current-conditions');
      }

      // Fetch forecast if requested
      if (options?.includeForecast !== false) {
        const forecast = await this.getForecast(location, options);
        if (forecast.success && forecast.data) {
          result.daily = forecast.data;
          sources.push('daily-forecast');
        }
      }

      // Fetch hourly if requested
      if (options?.includeHourly) {
        const hourly = await this.getHourlyForecast(location, 24);
        if (hourly.success && hourly.data) {
          result.hourly = hourly.data;
          sources.push('hourly-forecast');
        }
      }

      // Calculate overall confidence
      result.metadata.confidence = this.calculateOverallConfidence(result);

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WEATHER_DATA_ERROR',
          message: 'Failed to fetch weather data',
          details: (error as Error).message
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate location parameters
   */
  private validateLocation(location: Location): string | null {
    if (!location) {
      return 'Location is required';
    }
    
    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return 'Location must have valid latitude and longitude numbers';
    }
    
    if (location.latitude < -90 || location.latitude > 90) {
      return 'Latitude must be between -90 and 90 degrees';
    }
    
    if (location.longitude < -180 || location.longitude > 180) {
      return 'Longitude must be between -180 and 180 degrees';
    }
    
    if (location.name && typeof location.name !== 'string') {
      return 'Location name must be a string';
    }
    
    return null; // Valid location
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Reset counter if window expired
    if (now - this.lastResetTime > WeatherService.RATE_LIMIT_WINDOW) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // Check limit
    const limit = this.config.apiLimits?.maxRequestsPerMinute || WeatherService.DEFAULT_MAX_REQUESTS_PER_MINUTE;
    if (this.requestCount >= limit) {
      return false;
    }

    this.requestCount++;
    return true;
  }

  /**
   * Cache management
   */
  private buildCacheKey(request: WeatherQueryRequest, location: Location): string {
    const keyParts = [
      'weather',
      `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`,
      request.options?.units || 'metric',
      request.options?.language || 'en',
      request.options?.includeHourly ? 'hourly' : 'no-hourly',
      request.options?.includeForecast ? 'forecast' : 'no-forecast'
    ];
    
    return keyParts.join(':');
  }

  private getFromCache<T>(key: string): T | null {
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        this.cacheMisses++;
        return null;
      }
      
      if (Date.now() > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        this.cacheEvictions++;
        this.cacheMisses++;
        return null;
      }
      
      this.cacheHits++;
      return entry.data;
    } catch (error) {
      this.cacheErrors++;
      logger.error('Cache retrieval error', { key, error: (error as Error).message });
      // Remove corrupted entry
      this.cache.delete(key);
      return null;
    }
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    try {
      // Validate TTL
      if (ttl <= 0) {
        logger.warn('Invalid cache TTL', { key, ttl });
        return;
      }
      
      // Check cache size bounds to prevent memory leaks
      if (this.cache.size >= WeatherService.MAX_CACHE_SIZE) {
        this.cleanupCache();
        
        // If still at max after cleanup, remove oldest entries
        if (this.cache.size >= WeatherService.MAX_CACHE_SIZE) {
          const entriesToRemove = this.cache.size - WeatherService.CACHE_CLEANUP_THRESHOLD;
          const entries = Array.from(this.cache.entries())
            .sort(([,a], [,b]) => a.timestamp - b.timestamp);
          
          for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
            this.cache.delete(entries[i][0]);
          }
          
          logger.info('Cache size reduced', { 
            removed: Math.min(entriesToRemove, entries.length),
            currentSize: this.cache.size 
          });
        }
      }
      
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl
      });
      
      // Check if we should warn about cache size
      if (this.cache.size >= WeatherService.CACHE_WARNING_THRESHOLD) {
        logger.warn('Cache size approaching limit', { 
          currentSize: this.cache.size,
          maxSize: WeatherService.MAX_CACHE_SIZE,
          hitRate: this.getCacheHitRate()
        });
      }
    } catch (error) {
      this.cacheErrors++;
      logger.error('Cache storage error', { key, error: (error as Error).message });
    }
  }

  /**
   * Get differentiated TTL based on data type and request characteristics
   * Different data types have different update frequencies and cache strategies
   */
  private getCacheTTL(request: WeatherQueryRequest): number {
    const config = this.config.cache?.config;
    
    // Determine data type from request
    const queryType = this.determineQueryType(request);
    
    switch (queryType) {
      case 'current_weather':
        return config?.currentWeatherTTL || WeatherService.CURRENT_WEATHER_TTL;
      
      case 'forecast':
        // Longer TTL for forecast data as it changes less frequently
        return config?.forecastTTL || WeatherService.FORECAST_TTL;
      
      case 'historical':
        // Historical data never changes, very long TTL
        return config?.historicalTTL || WeatherService.HISTORICAL_TTL;
      
      case 'location':
        // Location data is very stable, longest TTL
        return config?.locationTTL || WeatherService.LOCATION_CACHE_TTL;
      
      default:
        return config?.defaultTTL || WeatherService.DEFAULT_CACHE_TTL;
    }
  }

  /**
   * Determine query type for TTL strategy
   */
  private determineQueryType(request: WeatherQueryRequest): string {
    const query = request.query.toLowerCase();
    
    if (query.includes('forecast') || query.includes('tomorrow') || query.includes('next') || 
        query.includes('預報') || query.includes('明天')) {
      return 'forecast';
    }
    
    if (query.includes('yesterday') || query.includes('last') || query.includes('historical') ||
        query.includes('昨天') || query.includes('過去') || query.includes('歷史')) {
      return 'historical';
    }
    
    if (request.options?.includeHourly || request.options?.forecastDays) {
      return 'forecast';
    }
    
    // Check if this is primarily a location query
    if (query.includes('where') || query.includes('location') || query.includes('find') ||
        query.includes('哪裡') || query.includes('位置') || query.includes('地點')) {
      return 'location';
    }
    
    return 'current_weather';
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.cacheEvictions += cleanedCount;
      logger.debug('Cache cleanup completed', { 
        removed: cleanedCount,
        currentSize: this.cache.size,
        hitRate: this.getCacheHitRate()
      });
    }
  }

  /**
   * Get current cache hit rate
   */
  private getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? Math.round((this.cacheHits / total) * 100) / 100 : 0;
  }

  /**
   * Get comprehensive cache performance metrics
   */
  getCacheMetrics(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    errors: number;
    memoryUsage: string;
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    
    return {
      size: this.cache.size,
      maxSize: WeatherService.MAX_CACHE_SIZE,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.getCacheHitRate(),
      evictions: this.cacheEvictions,
      errors: this.cacheErrors,
      memoryUsage: `${Math.round((this.cache.size / WeatherService.MAX_CACHE_SIZE) * 100)}%`
    };
  }

  /**
   * Helper methods
   */
  private getDataTypes(data: WeatherQueryResult): string[] {
    const types: string[] = [];
    if (data.current) types.push('current');
    if (data.daily) types.push('daily');
    if (data.hourly) types.push('hourly');
    return types;
  }

  private calculateOverallConfidence(result: WeatherQueryResult): number {
    let confidence = 0.5; // Base confidence
    
    if (result.current) confidence += 0.3;
    if (result.daily) confidence += 0.2;
    if (result.hourly) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  /**
   * Create location not supported response with transparent messaging
   * Replaces mock data fallback with honest error reporting
   */
  private createLocationNotSupportedResponse(location: Location, details: string): WeatherAPIResponse<any> {
    const locationDisplay = location.name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    
    return {
      success: false,
      error: {
        code: 'LOCATION_NOT_SUPPORTED',
        message: `Weather information is not available for ${locationDisplay}`,
        details: `${details}. This location may not be covered by our weather data provider. Try a nearby major city or different location.`
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * TEMPORARY: Mock response methods (fallback when APIs not available)
   * TODO Phase 4: Remove mock implementations when real weather APIs are integrated
   * @deprecated These provide consistent test data during development phase only
   * These methods will be removed once actual weather API integration is complete
   */
  private createMockCurrentWeather(location: Location, options?: WeatherQueryRequest['options']): WeatherAPIResponse<CurrentWeatherData> {
    const temp = 20 + (Math.random() - 0.5) * 20;
    
    return {
      success: true,
      data: {
        location,
        timestamp: new Date().toISOString(),
        temperature: {
          celsius: temp,
          fahrenheit: temp * 9/5 + 32
        },
        humidity: 60 + Math.random() * 30,
        windSpeed: {
          metersPerSecond: Math.random() * 10,
          kilometersPerHour: Math.random() * 36
        },
        windDirection: Math.random() * 360,
        pressure: 1000 + Math.random() * 50,
        visibility: 8000 + Math.random() * 5000,
        uvIndex: Math.floor(Math.random() * 11),
        description: 'Mock weather condition',
        iconCode: '02d',
        sunrise: '06:30:00',
        sunset: '18:45:00'
      },
      timestamp: new Date().toISOString()
    };
  }

  private createMockForecast(location: Location, options?: WeatherQueryRequest['options']): WeatherAPIResponse<DailyForecast[]> {
    const days = options?.forecastDays || 7;
    const forecasts: DailyForecast[] = [];
    
    for (let i = 0; i < days; i++) {
      const baseTemp = 20 + (Math.random() - 0.5) * 15;
      forecasts.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        location,
        conditions: {
          morning: this.createMockCondition(baseTemp - 3),
          afternoon: this.createMockCondition(baseTemp + 5),
          evening: this.createMockCondition(baseTemp),
          night: this.createMockCondition(baseTemp - 5)
        },
        summary: {
          high: baseTemp + 5,
          low: baseTemp - 5,
          precipitationChance: Math.floor(Math.random() * 100),
          description: 'Mock forecast'
        }
      });
    }
    
    return {
      success: true,
      data: forecasts,
      timestamp: new Date().toISOString()
    };
  }

  private createMockHourlyForecast(location: Location, hours: number): WeatherAPIResponse<HourlyForecast> {
    const periods = [];
    const baseTemp = 20 + (Math.random() - 0.5) * 15;
    
    for (let i = 0; i < hours; i++) {
      periods.push({
        time: new Date(Date.now() + i * 60 * 60 * 1000).toISOString(),
        ...this.createMockCondition(baseTemp + (Math.random() - 0.5) * 8),
        precipitationProbability: Math.floor(Math.random() * 100),
        precipitationAmount: Math.random() * 5
      });
    }
    
    return {
      success: true,
      data: { location, periods },
      timestamp: new Date().toISOString()
    };
  }

  private createMockCondition(temp: number) {
    return {
      temperature: {
        celsius: temp,
        fahrenheit: temp * 9/5 + 32
      },
      humidity: 60 + Math.random() * 30,
      windSpeed: {
        metersPerSecond: Math.random() * 10,
        kilometersPerHour: Math.random() * 36
      },
      windDirection: Math.random() * 360,
      pressure: 1000 + Math.random() * 50,
      visibility: 8000 + Math.random() * 5000,
      description: 'Mock condition',
      iconCode: '02d'
    };
  }

  private createMockLocationSearch(query: string): WeatherAPIResponse<LocationConfirmation> {
    return {
      success: true,
      data: {
        location: {
          latitude: 25.0330 + (Math.random() - 0.5) * 2,
          longitude: 121.5654 + (Math.random() - 0.5) * 2,
          name: `Mock Location for "${query}"`,
          country: 'Mock Country',
          region: 'Mock Region'
        },
        confidence: 0.8,
        source: 'fuzzy',
        needsConfirmation: false
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Service health check
   */
  async healthCheck(): Promise<{ weather: boolean; location: boolean; cache: boolean }> {
    const weather = this.weatherClient ? 
      await this.weatherClient.healthCheck() : true; // Mock is always healthy
      
    const location = this.locationService ? 
      await this.locationService.healthCheck() : true; // Mock is always healthy
      
    const cache = this.config.cache?.enabled ? this.cache.size < 10000 : true;

    return { weather, location, cache };
  }

  /**
   * Get comprehensive service statistics including cache metrics
   */
  getStatistics(): object {
    const cacheMetrics = this.getCacheMetrics();
    
    return {
      requests: {
        total: this.requestCount,
        resetTime: new Date(this.lastResetTime).toISOString()
      },
      cache: cacheMetrics,
      services: {
        weatherClient: !!this.weatherClient,
        locationService: !!this.locationService,
        cacheEnabled: !!this.config.cache?.enabled
      },
      performance: {
        cacheHitRate: cacheMetrics.hitRate,
        memoryUsage: cacheMetrics.memoryUsage,
        healthStatus: cacheMetrics.errors === 0 ? 'healthy' : 'degraded'
      }
    };
  }
}