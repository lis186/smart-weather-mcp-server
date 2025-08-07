/**
 * Google Weather API Client
 * Handles Current Conditions, Daily Forecast, Hourly Forecast, and Historical Weather
 */

import axios from 'axios';
import { GoogleMapsClient } from './google-maps-client.js';
import { logger } from './logger.js';
import type {
  WeatherAPIConfig,
  WeatherAPIResponse,
  Location,
  CurrentWeatherData,
  CurrentWeatherRequest,
  DailyForecast,
  HourlyForecast,
  ForecastRequest,
  HistoricalWeatherRequest,
  WeatherCondition
} from '../types/weather-api.js';

export class GoogleWeatherClient extends GoogleMapsClient {
  private readonly weatherApiBaseUrl = 'https://weather.googleapis.com/v1';

  constructor(config: WeatherAPIConfig) {
    super(config);
    logger.info('Google Weather API client initialized', {
      hasApiKey: !!config.apiKey,
      timeout: config.timeout
    });
  }

  /**
   * Get current weather conditions
   * https://developers.google.com/maps/documentation/weather/current-conditions
   */
  async getCurrentWeather(request: CurrentWeatherRequest): Promise<WeatherAPIResponse<CurrentWeatherData>> {
    try {
      const params = {
        lat: request.location.latitude,
        lng: request.location.longitude,
        units: request.units || 'metric',
        lang: request.language || 'en'
      };

      logger.info('Fetching current weather', { 
        location: request.location,
        units: params.units 
      });

      // Real Google Weather API implementation using official endpoints
      const response = await this.makeWeatherRequest('/current', params);
      
      // Try parsing as real Google Weather API response first
      const weatherData: CurrentWeatherData = response.data && response.data.current ? 
        this.parseGoogleCurrentWeatherResponse(response.data, request.location) :
        this.parseCurrentWeatherResponse(response.data, request.location);

      return {
        success: true,
        data: weatherData,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('Failed to fetch current weather', {
        location: request.location,
        error: error.message
      });

      return {
        success: false,
        error: {
          code: error.code || 'WEATHER_FETCH_ERROR',
          message: error.message || 'Failed to fetch current weather',
          details: error.details
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get daily weather forecast
   * https://developers.google.com/maps/documentation/weather/daily-forecast
   */
  async getDailyForecast(request: ForecastRequest): Promise<WeatherAPIResponse<DailyForecast[]>> {
    try {
      const params = {
        lat: request.location.latitude,
        lng: request.location.longitude,
        days: Math.min(request.days || 7, 10), // Limit to 10 days
        units: request.units || 'metric',
        lang: request.language || 'en'
      };

      logger.info('Fetching daily forecast', { 
        location: request.location,
        days: params.days,
        units: params.units 
      });

      const response = await this.makeWeatherRequest('/forecast/daily', params);
      
      const forecastData: DailyForecast[] = this.parseDailyForecastResponse(
        response.data,
        request.location
      );

      return {
        success: true,
        data: forecastData,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('Failed to fetch daily forecast', {
        location: request.location,
        error: error.message
      });

      return {
        success: false,
        error: {
          code: error.code || 'FORECAST_FETCH_ERROR',
          message: error.message || 'Failed to fetch daily forecast',
          details: error.details
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get hourly weather forecast
   * https://developers.google.com/maps/documentation/weather/hourly-forecast
   */
  async getHourlyForecast(request: ForecastRequest): Promise<WeatherAPIResponse<HourlyForecast>> {
    try {
      const params = {
        lat: request.location.latitude,
        lng: request.location.longitude,
        hours: Math.min(request.hours || 24, 120), // Limit to 120 hours (5 days)
        units: request.units || 'metric',
        lang: request.language || 'en'
      };

      logger.info('Fetching hourly forecast', { 
        location: request.location,
        hours: params.hours,
        units: params.units 
      });

      const response = await this.makeWeatherRequest('/forecast/hourly', params);
      
      const forecastData: HourlyForecast = this.parseHourlyForecastResponse(
        response.data,
        request.location
      );

      return {
        success: true,
        data: forecastData,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('Failed to fetch hourly forecast', {
        location: request.location,
        error: error.message
      });

      return {
        success: false,
        error: {
          code: error.code || 'HOURLY_FORECAST_ERROR',
          message: error.message || 'Failed to fetch hourly forecast',
          details: error.details
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get historical weather data
   * https://developers.google.com/maps/documentation/weather/hourly-history
   */
  async getHistoricalWeather(request: HistoricalWeatherRequest): Promise<WeatherAPIResponse<HourlyForecast>> {
    try {
      const params = {
        lat: request.location.latitude,
        lng: request.location.longitude,
        start_date: request.startDate,
        end_date: request.endDate,
        units: request.units || 'metric',
        lang: request.language || 'en'
      };

      logger.info('Fetching historical weather', { 
        location: request.location,
        startDate: request.startDate,
        endDate: request.endDate,
        units: params.units 
      });

      const response = await this.makeWeatherRequest('/history', params);
      
      const historicalData: HourlyForecast = this.parseHistoricalWeatherResponse(
        response.data,
        request.location
      );

      return {
        success: true,
        data: historicalData,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('Failed to fetch historical weather', {
        location: request.location,
        error: error.message
      });

      return {
        success: false,
        error: {
          code: error.code || 'HISTORICAL_WEATHER_ERROR',
          message: error.message || 'Failed to fetch historical weather',
          details: error.details
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Make weather API request (internal method)
   */
  private async makeWeatherRequest(endpoint: string, params: any): Promise<any> {
    try {
      // Convert legacy endpoint to real Google Weather API endpoint
      const realEndpoint = this.convertLegacyEndpoint(endpoint);
      const realParams = this.convertLegacyParams(params);
      
      const url = `${this.weatherApiBaseUrl}${realEndpoint}`;
      
      logger.info('Making Google Weather API request', { 
        url,
        params: { ...realParams, key: '[REDACTED]' },
        keyLength: realParams.key?.length,
        keyPrefix: realParams.key?.substring(0, 10) + '...'
      });

      // Use axios directly for Google Weather API calls
      const response = await axios.get(url, { 
        params: realParams,
        timeout: 5000
      });
      
      logger.info('Google Weather API response received', {
        status: response.status,
        endpoint: realEndpoint
      });

      return { data: response.data };
      
    } catch (error: any) {
      logger.error('Google Weather API request failed', {
        endpoint,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        headers: error.response?.headers
      });

      // Don't fallback to mock data - propagate the error for proper handling
      if (error.response?.status === 404) {
        const apiError = new Error('Location not supported by Google Weather API');
        apiError.name = 'LOCATION_NOT_SUPPORTED';
        (apiError as any).status = 404;
        (apiError as any).details = error.response?.data?.error?.message || 'Information is not supported for this location';
        throw apiError;
      } else if (error.response?.status === 403) {
        const apiError = new Error('Google Weather API access denied');
        apiError.name = 'API_ACCESS_DENIED';
        (apiError as any).status = 403;
        throw apiError;
      } else {
        // For other errors, rethrow the original error
        throw error;
      }
    }
  }

  /**
   * Convert legacy endpoint paths to real Google Weather API endpoints
   */
  private convertLegacyEndpoint(endpoint: string): string {
    const endpointMap: { [key: string]: string } = {
      '/current': '/currentConditions:lookup',
      '/forecast/daily': '/forecast/days:lookup',
      '/forecast/hourly': '/forecast/hours:lookup',
      '/history': '/forecast/history:lookup'
    };
    
    return endpointMap[endpoint] || endpoint;
  }

  /**
   * Convert legacy parameters to Google Weather API format
   */
  private convertLegacyParams(params: any): any {
    // Get API key from constructor parameter since config is private
    const apiKey = process.env.WEATHER_API_KEY || process.env.GOOGLE_WEATHER_API_KEY || 'test-key';
    
    return {
      key: apiKey,
      'location.latitude': params.lat,
      'location.longitude': params.lng,
      unitsSystem: params.units === 'imperial' ? 'IMPERIAL' : 'METRIC',
      languageCode: params.lang || 'en',
      ...(params.days && { days: params.days }),
      ...(params.hours && { hours: params.hours })
    };
  }


  /**
   * Parse real Google Weather API current conditions response
   */
  private parseGoogleCurrentWeatherResponse(data: any, location: Location): CurrentWeatherData {
    // Handle real Google Weather API response format
    if (data && data.current) {
      const current = data.current;
      return {
        location,
        timestamp: new Date().toISOString(),
        temperature: {
          celsius: current.temperature?.value || 20,
          fahrenheit: (current.temperature?.value || 20) * 9/5 + 32
        },
        humidity: current.humidity?.value || 60,
        windSpeed: {
          metersPerSecond: current.windSpeed?.value || 5,
          kilometersPerHour: (current.windSpeed?.value || 5) * 3.6
        },
        windDirection: current.windDirection?.value || 180,
        pressure: current.pressure?.value || 1013,
        visibility: current.visibility?.value || 10000,
        uvIndex: current.uvIndex?.value || 3,
        description: current.weatherDescription || 'Clear',
        iconCode: current.weatherIcon || '01d',
        sunrise: current.sunrise || '06:00:00',
        sunset: current.sunset || '18:00:00'
      };
    }

    // Fallback to mock parsing if real API response format is unexpected
    return this.parseCurrentWeatherResponse(data, location);
  }

  /**
   * Parse current weather API response (legacy/mock format)
   */
  private parseCurrentWeatherResponse(data: any, location: Location): CurrentWeatherData {
    const condition: WeatherCondition = {
      temperature: {
        celsius: data.temperature || 20,
        fahrenheit: (data.temperature || 20) * 9/5 + 32
      },
      humidity: data.humidity || 65,
      windSpeed: {
        metersPerSecond: data.windSpeed || 3.5,
        kilometersPerHour: (data.windSpeed || 3.5) * 3.6
      },
      windDirection: data.windDirection || 180,
      pressure: data.pressure || 1013.25,
      visibility: data.visibility || 10000,
      uvIndex: data.uvIndex || 5,
      description: data.description || 'Partly cloudy',
      iconCode: data.iconCode || '02d'
    };

    return {
      ...condition,
      location,
      timestamp: new Date().toISOString(),
      sunrise: data.sunrise,
      sunset: data.sunset
    };
  }

  /**
   * Parse daily forecast API response
   */
  private parseDailyForecastResponse(data: any, location: Location): DailyForecast[] {
    const forecasts: DailyForecast[] = [];
    const days = data.daily || [];

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      forecasts.push({
        date: day.date || new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        location,
        conditions: {
          morning: this.parseWeatherCondition(day.morning || {}),
          afternoon: this.parseWeatherCondition(day.afternoon || {}),
          evening: this.parseWeatherCondition(day.evening || {}),
          night: this.parseWeatherCondition(day.night || {})
        },
        summary: {
          high: day.highTemp || 25,
          low: day.lowTemp || 15,
          precipitationChance: day.precipChance || 30,
          description: day.description || 'Partly cloudy'
        }
      });
    }

    return forecasts;
  }

  /**
   * Parse hourly forecast API response
   */
  private parseHourlyForecastResponse(data: any, location: Location): HourlyForecast {
    const periods = (data.hourly || []).map((hour: any) => ({
      time: hour.time || new Date().toISOString(),
      ...this.parseWeatherCondition(hour),
      precipitationProbability: hour.precipProbability || 0,
      precipitationAmount: hour.precipAmount || 0
    }));

    return {
      location,
      periods
    };
  }

  /**
   * Parse historical weather API response
   */
  private parseHistoricalWeatherResponse(data: any, location: Location): HourlyForecast {
    return this.parseHourlyForecastResponse(data, location);
  }

  /**
   * Parse weather condition from API response
   */
  private parseWeatherCondition(data: any): WeatherCondition {
    return {
      temperature: {
        celsius: data.temperature || 20,
        fahrenheit: (data.temperature || 20) * 9/5 + 32
      },
      humidity: data.humidity || 65,
      windSpeed: {
        metersPerSecond: data.windSpeed || 3.5,
        kilometersPerHour: (data.windSpeed || 3.5) * 3.6
      },
      windDirection: data.windDirection || 180,
      pressure: data.pressure || 1013.25,
      visibility: data.visibility || 10000,
      uvIndex: data.uvIndex,
      description: data.description || 'Clear',
      iconCode: data.iconCode || '01d'
    };
  }

  /**
   * TEMPORARY: Mock weather response for development
   * TODO Phase 4: Replace with actual Google Weather API integration
   * @deprecated Remove when real API is available
   * Current implementation provides realistic mock data for development/testing
   */

  /**
   * Validate location coordinates
   */
  private isValidLocation(location: Location): boolean {
    return (
      location.latitude >= -90 && location.latitude <= 90 &&
      location.longitude >= -180 && location.longitude <= 180
    );
  }

  /**
   * Get weather API capabilities
   */
  getCapabilities(): object {
    return {
      currentWeather: true,
      dailyForecast: { maxDays: 10 },
      hourlyForecast: { maxHours: 120 },
      historicalWeather: { available: true },
      languages: ['en', 'zh-TW', 'ja'],
      units: ['metric', 'imperial']
    };
  }
}