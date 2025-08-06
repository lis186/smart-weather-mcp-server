/**
 * Unified Weather Service
 * Integrates all weather and location APIs into a single service interface
 */

import { GoogleWeatherClient } from './google-weather-client.js';
import { LocationService } from './location-service.js';
import { SecretManager } from './secret-manager.js';
import { logger } from './logger.js';
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

  constructor(config: WeatherServiceConfig) {
    this.config = config;
    this.initializeServices();
    
    // Setup cache cleanup interval
    if (config.cache?.enabled) {
      setInterval(() => this.cleanupCache(), 60000); // Every minute
    }

    logger.info('Weather service initialized', {
      cacheEnabled: config.cache?.enabled,
      apiLimitsEnabled: !!config.apiLimits
    });
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
        
        logger.info('Weather APIs initialized successfully');
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
      const weatherApiKey = await this.config.secretManager.getSecret(
        'GOOGLE_WEATHER_API_KEY_SECRET'
      ) || await this.config.secretManager.getSecret(
        'GOOGLE_WEATHER_API_KEY'
      );
      
      return { weatherApiKey };
    } catch (error) {
      logger.error('Failed to load weather API secrets', { 
        error: (error as Error).message 
      });
      return {};
    }
  }

  /**
   * Main weather query method - handles all types of weather requests
   */
  async queryWeather(request: WeatherQueryRequest): Promise<WeatherAPIResponse<WeatherQueryResult>> {
    try {
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
    if (!this.weatherClient) {
      return this.createMockCurrentWeather(location, options);
    }

    const request: CurrentWeatherRequest = {
      location,
      units: options?.units || 'metric',
      language: options?.language || 'en'
    };

    return this.weatherClient.getCurrentWeather(request);
  }

  /**
   * Get weather forecast for a location
   */
  async getForecast(location: Location, options?: WeatherQueryRequest['options']): Promise<WeatherAPIResponse<DailyForecast[]>> {
    if (!this.weatherClient) {
      return this.createMockForecast(location, options);
    }

    const request: ForecastRequest = {
      location,
      days: options?.forecastDays || 7,
      units: options?.units || 'metric',
      language: options?.language || 'en'
    };

    return this.weatherClient.getDailyForecast(request);
  }

  /**
   * Get hourly forecast for a location
   */
  async getHourlyForecast(location: Location, hours: number = 24): Promise<WeatherAPIResponse<HourlyForecast>> {
    if (!this.weatherClient) {
      return this.createMockHourlyForecast(location, hours);
    }

    const request: ForecastRequest = {
      location,
      hours,
      units: 'metric',
      language: 'en'
    };

    return this.weatherClient.getHourlyForecast(request);
  }

  /**
   * Search for locations
   */
  async searchLocations(query: string, options?: LocationSearchOptions): Promise<WeatherAPIResponse<LocationConfirmation>> {
    if (!this.locationService) {
      return this.createMockLocationSearch(query);
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
   * Rate limiting check
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute

    // Reset counter if window expired
    if (now - this.lastResetTime > timeWindow) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // Check limit
    const limit = this.config.apiLimits?.maxRequestsPerMinute || 60;
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
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private getCacheTTL(request: WeatherQueryRequest): number {
    const config = this.config.cache?.config;
    if (!config) return 300000; // 5 minutes default
    
    if (request.options?.includeHourly) {
      return config.forecastTTL;
    }
    
    return config.currentWeatherTTL;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
      }
    }
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
   * Mock response methods (fallback when APIs not available)
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
   * Get service statistics
   */
  getStatistics(): object {
    return {
      requestCount: this.requestCount,
      cacheSize: this.cache.size,
      services: {
        weatherClient: !!this.weatherClient,
        locationService: !!this.locationService
      },
      lastResetTime: new Date(this.lastResetTime).toISOString()
    };
  }
}