/**
 * Google Maps Platform API Client
 * Handles all Google Maps API interactions including Weather and Geocoding
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from './logger.js';
import type {
  WeatherAPIConfig,
  WeatherAPIResponse,
  WeatherAPIError,
  Location,
  LocationQuery,
  GeocodingResponse,
  GeocodingResult,
  CurrentWeatherData,
  CurrentWeatherRequest,
  DailyForecast,
  HourlyForecast,
  ForecastRequest,
  HistoricalWeatherRequest
} from '../types/weather-api.js';

export class GoogleMapsClient {
  private readonly client: AxiosInstance;
  private readonly config: WeatherAPIConfig;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api';
  private readonly weatherBaseUrl = 'https://maps.googleapis.com/maps/api/weather';

  // Configuration constants
  private static readonly DEFAULT_TIMEOUT = 5000;
  private static readonly DEFAULT_RETRY_ATTEMPTS = 3;
  private static readonly DEFAULT_RATE_LIMIT_DELAY = 1000;

  constructor(config: WeatherAPIConfig) {
    // Validate API key format for production security
    if (!config.apiKey || !this.isValidApiKeyFormat(config.apiKey)) {
      throw new Error('Invalid Google Maps API key format');
    }
    
    this.config = {
      timeout: GoogleMapsClient.DEFAULT_TIMEOUT,
      retryAttempts: GoogleMapsClient.DEFAULT_RETRY_ATTEMPTS,
      rateLimitDelay: GoogleMapsClient.DEFAULT_RATE_LIMIT_DELAY,
      ...config
    };

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Smart-Weather-MCP-Server/1.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add API key to all requests
        if (!config.params) {
          config.params = {};
        }
        config.params.key = this.config.apiKey;
        
        logger.info('Google Maps API request', {
          url: config.url,
          method: config.method,
          params: { ...config.params, key: '[REDACTED]' }
        });

        return config;
      },
      (error) => {
        logger.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Google Maps API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      async (error) => {
        const apiError = this.handleAPIError(error);
        
        // Retry logic for retryable errors
        if (apiError.retryable && this.shouldRetry(error.config)) {
          return this.retryRequest(error.config);
        }

        return Promise.reject(apiError);
      }
    );
  }

  private handleAPIError(error: any): WeatherAPIError {
    const apiError = new Error() as WeatherAPIError;
    
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          apiError.code = 'INVALID_REQUEST';
          apiError.message = 'Invalid request parameters';
          apiError.retryable = false;
          break;
        case 401:
          apiError.code = 'INVALID_API_KEY';
          apiError.message = 'API key is invalid or missing';
          apiError.retryable = false;
          break;
        case 403:
          apiError.code = 'API_QUOTA_EXCEEDED';
          apiError.message = 'API quota exceeded or access denied';
          apiError.retryable = false;
          break;
        case 404:
          apiError.code = 'NOT_FOUND';
          apiError.message = 'Location not found or API endpoint not available';
          apiError.retryable = false;
          break;
        case 429:
          apiError.code = 'RATE_LIMITED';
          apiError.message = 'Rate limit exceeded';
          apiError.retryable = true;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          apiError.code = 'SERVER_ERROR';
          apiError.message = 'Google Maps API server error';
          apiError.retryable = true;
          break;
        default:
          apiError.code = 'UNKNOWN_ERROR';
          apiError.message = `Unexpected API error: ${status}`;
          apiError.retryable = false;
      }
      
      apiError.status = status;
      apiError.details = data?.error_message || data?.message;
      
    } else if (error.request) {
      // Network error
      apiError.code = 'NETWORK_ERROR';
      apiError.message = 'Network connection failed';
      apiError.retryable = true;
      
    } else {
      // Other error
      apiError.code = 'CLIENT_ERROR';
      apiError.message = error.message || 'Unknown client error';
      apiError.retryable = false;
    }

    logger.error('Google Maps API error', {
      code: apiError.code,
      message: apiError.message,
      status: apiError.status,
      details: apiError.details,
      retryable: apiError.retryable
    });

    return apiError;
  }

  private shouldRetry(config: any): boolean {
    const retryCount = (config._retryCount || 0);
    return retryCount < (this.config.retryAttempts || 3);
  }

  private async retryRequest(config: any): Promise<AxiosResponse> {
    const retryCount = (config._retryCount || 0) + 1;
    const delay = this.config.rateLimitDelay! * Math.pow(2, retryCount - 1); // Exponential backoff
    
    logger.info('Retrying Google Maps API request', {
      retryCount,
      delay,
      url: config.url
    });

    await this.sleep(delay);
    
    config._retryCount = retryCount;
    return this.client(config);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Geocoding API - Convert address to coordinates
   */
  async geocode(query: LocationQuery): Promise<WeatherAPIResponse<GeocodingResult[]>> {
    try {
      const params: any = {
        address: query.query,
        language: query.language || 'en'
      };

      if (query.bias) {
        params.region = `${query.bias.latitude},${query.bias.longitude}`;
        if (query.bias.radius) {
          params.radius = query.bias.radius;
        }
      }

      const response = await this.client.get('/geocode/json', { params });
      
      const results: GeocodingResult[] = response.data.results.map((result: any) => ({
        location: {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          name: result.formatted_address,
          country: this.extractAddressComponent(result, 'country'),
          region: this.extractAddressComponent(result, 'administrative_area_level_1')
        },
        formattedAddress: result.formatted_address,
        addressComponents: result.address_components,
        confidence: this.calculateConfidence(result.types)
      }));

      return {
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: (error as WeatherAPIError).code,
          message: (error as WeatherAPIError).message,
          details: (error as WeatherAPIError).details
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Reverse Geocoding API - Convert coordinates to address
   */
  async reverseGeocode(location: Location): Promise<WeatherAPIResponse<GeocodingResult[]>> {
    try {
      const params = {
        latlng: `${location.latitude},${location.longitude}`,
        language: 'en'
      };

      const response = await this.client.get('/geocode/json', { params });
      
      const results: GeocodingResult[] = response.data.results.map((result: any) => ({
        location: {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          name: result.formatted_address,
          country: this.extractAddressComponent(result, 'country'),
          region: this.extractAddressComponent(result, 'administrative_area_level_1')
        },
        formattedAddress: result.formatted_address,
        addressComponents: result.address_components,
        confidence: this.calculateConfidence(result.types)
      }));

      return {
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: (error as WeatherAPIError).code,
          message: (error as WeatherAPIError).message,
          details: (error as WeatherAPIError).details
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  private extractAddressComponent(result: any, type: string): string | undefined {
    const component = result.address_components?.find((comp: any) => 
      comp.types?.includes(type)
    );
    return component?.long_name || component?.short_name;
  }

  private calculateConfidence(types: string[]): number {
    // Higher confidence for more specific location types
    if (types.includes('street_address')) return 0.95;
    if (types.includes('premise')) return 0.90;
    if (types.includes('point_of_interest')) return 0.85;
    if (types.includes('locality')) return 0.80;
    if (types.includes('administrative_area_level_1')) return 0.70;
    if (types.includes('country')) return 0.60;
    return 0.50;
  }

  /**
   * Health check for the API client
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test with a simple geocoding request
      await this.client.get('/geocode/json', {
        params: {
          address: 'New York',
          key: this.config.apiKey
        },
        timeout: 3000
      });
      return true;
    } catch (error) {
      logger.error('Google Maps API health check failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  /**
   * Validate Google Maps API key format
   * Google Maps API keys typically start with 'AIza' and are 39 characters long
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    // Google Maps API keys typically start with 'AIza' and are 39 characters
    // However, this can vary, so we use a more lenient validation
    return apiKey.length >= 20 && apiKey.length <= 50 && 
           /^[A-Za-z0-9_-]+$/.test(apiKey);
  }

  /**
   * Get current API usage statistics
   */
  getUsageStats(): object {
    return {
      baseUrl: this.baseUrl,
      timeout: this.config.timeout,
      retryAttempts: this.config.retryAttempts,
      hasApiKey: !!this.config.apiKey
    };
  }
}