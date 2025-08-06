/**
 * Google Weather API Client
 * Handles Current Conditions, Daily Forecast, Hourly Forecast, and Historical Weather
 */

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
  private readonly weatherApiBaseUrl = 'https://maps.googleapis.com/maps/api/weather';

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

      // Note: Google Weather API endpoint structure (placeholder implementation)
      // Real implementation would use actual Google Weather API endpoints
      const response = await this.makeWeatherRequest('/current', params);
      
      const weatherData: CurrentWeatherData = this.parseCurrentWeatherResponse(
        response.data,
        request.location
      );

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
    // For now, this creates mock responses since Google Weather API is not yet publicly available
    // Real implementation will use actual API endpoints when available
    
    logger.info('Making weather API request', { endpoint, params: { ...params, key: '[REDACTED]' } });
    
    // Simulate API delay
    await this.sleep(100 + Math.random() * 200);
    
    return this.createMockWeatherResponse(endpoint, params);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse current weather API response
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
   * Create mock weather response (temporary implementation)
   */
  private createMockWeatherResponse(endpoint: string, params: any): any {
    const baseTemp = 20 + (Math.random() - 0.5) * 20; // 10-30°C
    
    switch (endpoint) {
      case '/current':
        return {
          data: {
            temperature: baseTemp,
            humidity: 60 + Math.random() * 30,
            windSpeed: Math.random() * 10,
            windDirection: Math.random() * 360,
            pressure: 1000 + Math.random() * 50,
            visibility: 8000 + Math.random() * 5000,
            uvIndex: Math.floor(Math.random() * 11),
            description: 'Mock current weather',
            iconCode: '02d',
            sunrise: '06:30:00',
            sunset: '18:45:00'
          }
        };
        
      case '/forecast/daily':
        const dailyData = [];
        for (let i = 0; i < (params.days || 7); i++) {
          const dayTemp = baseTemp + (Math.random() - 0.5) * 10;
          dailyData.push({
            date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            highTemp: dayTemp + 5,
            lowTemp: dayTemp - 5,
            precipChance: Math.floor(Math.random() * 100),
            description: 'Mock daily forecast',
            morning: { temperature: dayTemp - 2, description: 'Morning conditions' },
            afternoon: { temperature: dayTemp + 3, description: 'Afternoon conditions' },
            evening: { temperature: dayTemp, description: 'Evening conditions' },
            night: { temperature: dayTemp - 3, description: 'Night conditions' }
          });
        }
        return { data: { daily: dailyData } };
        
      case '/forecast/hourly':
        const hourlyData = [];
        for (let i = 0; i < (params.hours || 24); i++) {
          hourlyData.push({
            time: new Date(Date.now() + i * 60 * 60 * 1000).toISOString(),
            temperature: baseTemp + (Math.random() - 0.5) * 8,
            humidity: 60 + Math.random() * 30,
            windSpeed: Math.random() * 8,
            description: 'Mock hourly forecast',
            precipProbability: Math.floor(Math.random() * 100),
            precipAmount: Math.random() * 5
          });
        }
        return { data: { hourly: hourlyData } };
        
      case '/history':
        const historicalData = [];
        const startDate = new Date(params.start_date);
        const endDate = new Date(params.end_date);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
        
        for (let i = 0; i < diffHours; i++) {
          historicalData.push({
            time: new Date(startDate.getTime() + i * 60 * 60 * 1000).toISOString(),
            temperature: baseTemp + (Math.random() - 0.5) * 12,
            humidity: 50 + Math.random() * 40,
            windSpeed: Math.random() * 10,
            description: 'Mock historical data'
          });
        }
        return { data: { hourly: historicalData } };
        
      default:
        throw new Error(`Unknown weather endpoint: ${endpoint}`);
    }
  }

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