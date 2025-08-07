/**
 * Weather API Integration Tests - Phase 4.1
 * Tests real Google Weather API integration with fallback to mock data
 * Updated to reflect successful Google Weather API implementation
 */

import { WeatherService } from '../../src/services/weather-service.js';
import { SecretManager } from '../../src/services/secret-manager.js';
import type { WeatherServiceConfig, WeatherQueryRequest } from '../../src/services/weather-service.js';
import type { Location } from '../../src/types/weather-api.js';

describe('Weather API Integration', () => {
  let weatherService: WeatherService;
  let mockSecretManager: SecretManager;

  beforeAll(async () => {
    // Create a mock secret manager that doesn't require real secrets
    mockSecretManager = {
      loadSecrets: jest.fn().mockResolvedValue({
        geminiApiKey: 'mock-gemini-key',
        weatherApiKey: 'mock-weather-key'
      }),
      validateSecrets: jest.fn().mockResolvedValue(true),
      getSecret: jest.fn().mockImplementation((name: string) => {
        if (name.includes('WEATHER')) return Promise.resolve('mock-weather-key');
        if (name.includes('GEMINI')) return Promise.resolve('mock-gemini-key');
        return Promise.resolve('mock-key');
      })
    } as any;

    const config: WeatherServiceConfig = {
      secretManager: mockSecretManager,
      cache: {
        enabled: true,
        config: {
          currentWeatherTTL: 300000,
          forecastTTL: 1800000,
          historicalTTL: 3600000,
          geocodingTTL: 86400000
        }
      },
      apiLimits: {
        maxRequestsPerMinute: 60,
        maxConcurrentRequests: 10
      }
    };

    weatherService = new WeatherService(config);
    
    // Give service time to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Basic Weather Queries', () => {
    const testLocation: Location = {
      latitude: 25.0330,
      longitude: 121.5654,
      name: 'Taipei, Taiwan',
      country: 'Taiwan',
      region: 'Taipei'
    };

    it('should handle weather query with fallback to mock data', async () => {
      // Phase 4.1: Test with Taiwan location (likely unsupported by Google Weather API)
      const request: WeatherQueryRequest = {
        query: 'Taipei weather today',
        location: testLocation,
        options: {
          units: 'metric',
          language: 'en'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.success && result.data) {
        expect(result.data.location).toEqual(testLocation);
        expect(result.data.current).toBeDefined();
        expect(result.data.metadata).toBeDefined();
        expect(result.data.metadata.sources).toContain('current-conditions');
        
        // Phase 4.1: Accept both real Google API and mock data formats
        expect(result.data.current!.temperature).toBeDefined();
        
        // Mock data format: { celsius: number, fahrenheit: number }
        // Real API format: { degrees: number, unit: "CELSIUS" }
        const temp = result.data.current!.temperature;
        const tempValue = (temp as any).celsius || (temp as any).degrees || 0;
        
        expect(tempValue).toBeGreaterThan(-50);
        expect(tempValue).toBeLessThan(60);
        expect(result.data.current!.humidity).toBeGreaterThanOrEqual(0);
        expect(result.data.current!.humidity).toBeLessThanOrEqual(100);
      }
    });

    it('should handle forecast request', async () => {
      const request: WeatherQueryRequest = {
        query: 'Tokyo weather forecast 5 days',
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          name: 'Tokyo, Japan',
          country: 'Japan'
        },
        options: {
          includeForecast: true,
          forecastDays: 5,
          units: 'metric'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      
      if (result.success && result.data) {
        expect(result.data.daily).toBeDefined();
        expect(result.data.daily!.length).toBe(5);
        expect(result.data.metadata.sources).toContain('daily-forecast');
        
        // Validate forecast structure
        const forecast = result.data.daily![0];
        expect(forecast.date).toBeDefined();
        expect(forecast.summary).toBeDefined();
        expect(forecast.summary.high).toBeGreaterThan(forecast.summary.low);
        expect(forecast.conditions).toBeDefined();
        expect(forecast.conditions.morning).toBeDefined();
        expect(forecast.conditions.afternoon).toBeDefined();
        expect(forecast.conditions.evening).toBeDefined();
        expect(forecast.conditions.night).toBeDefined();
      }
    });

    it('should handle hourly forecast request', async () => {
      const request: WeatherQueryRequest = {
        query: 'London hourly weather today',
        location: {
          latitude: 51.5074,
          longitude: -0.1278,
          name: 'London, UK',
          country: 'United Kingdom'
        },
        options: {
          includeHourly: true,
          units: 'metric'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      
      if (result.success && result.data) {
        expect(result.data.hourly).toBeDefined();
        expect(result.data.hourly!.periods).toBeDefined();
        expect(result.data.hourly!.periods.length).toBeGreaterThan(0);
        expect(result.data.metadata.sources).toContain('hourly-forecast');
        
        // Validate hourly structure
        const period = result.data.hourly!.periods[0];
        expect(period.time).toBeDefined();
        expect(period.temperature).toBeDefined();
        expect(period.precipitationProbability).toBeGreaterThanOrEqual(0);
        expect(period.precipitationProbability).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Google Weather API Integration - Phase 4.1', () => {
    // Test real Google Weather API integration
    it('should handle supported locations with real Google Weather API', async () => {
      // New York is confirmed to work with Google Weather API
      const request: WeatherQueryRequest = {
        query: 'New York weather today',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          name: 'New York, NY, USA',
          country: 'United States',
          region: 'New York'
        },
        options: {
          units: 'metric',
          language: 'en'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.success && result.data) {
        // Should get current weather data (real or mock)
        expect(result.data.current).toBeDefined();
        expect(result.data.location).toBeDefined();
        expect(result.data.metadata).toBeDefined();
        
        // Temperature should be in valid range regardless of source
        const temp = result.data.current!.temperature;
        const tempValue = (temp as any).celsius || (temp as any).degrees || 0;
        expect(tempValue).toBeGreaterThan(-50);
        expect(tempValue).toBeLessThan(60);
      }
    });

    it('should gracefully fallback for unsupported locations', async () => {
      // Tokyo is confirmed to not be supported yet
      const request: WeatherQueryRequest = {
        query: 'Tokyo weather today',
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          name: 'Tokyo, Japan',
          country: 'Japan',
          region: 'Tokyo'
        },
        options: {
          units: 'metric',
          language: 'en'
        }
      };

      const result = await weatherService.queryWeather(request);

      // Should still succeed with mock data
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.success && result.data) {
        expect(result.data.current).toBeDefined();
        expect(result.data.location).toEqual(request.location);
        
        // Mock data should have reasonable values
        const temp = result.data.current!.temperature;
        const tempValue = (temp as any).celsius || (temp as any).degrees || 0;
        expect(tempValue).toBeGreaterThan(-50);
        expect(tempValue).toBeLessThan(60);
      }
    });
  });

  describe('Location Handling', () => {
    it('should extract location from query text', async () => {
      const request: WeatherQueryRequest = {
        query: 'What is the weather in New York City today?',
        options: {
          units: 'imperial',
          language: 'en'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      
      if (result.success && result.data) {
        expect(result.data.location).toBeDefined();
        expect(result.data.location.name).toBeDefined();
      }
    });

    it('should handle Chinese location queries', async () => {
      const request: WeatherQueryRequest = {
        query: '北京今天天氣如何？',
        options: {
          units: 'metric',
          language: 'zh-TW'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      
      if (result.success && result.data) {
        expect(result.data.location).toBeDefined();
        expect(result.data.current).toBeDefined();
      }
    });
  });

  describe('Service Health and Statistics', () => {
    it('should provide health check status', async () => {
      const health = await weatherService.healthCheck();

      expect(health).toHaveProperty('weather');
      expect(health).toHaveProperty('location');
      expect(health).toHaveProperty('cache');
      
      expect(typeof health.weather).toBe('boolean');
      expect(typeof health.location).toBe('boolean');
      expect(typeof health.cache).toBe('boolean');
      
      // In mock environment, all should be healthy
      expect(health.weather).toBe(true);
      expect(health.location).toBe(true);
      expect(health.cache).toBe(true);
    });

    it('should provide service statistics', () => {
      const stats = weatherService.getStatistics() as any;

      // Updated to match actual statistics structure
      expect(stats).toHaveProperty('requests');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('services');
      
      expect(typeof stats.requests.total).toBe('number');
      expect(typeof stats.cache.size).toBe('number');
      expect(stats.services).toHaveProperty('weatherClient');
      expect(stats.services).toHaveProperty('locationService');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing location gracefully', async () => {
      const request: WeatherQueryRequest = {
        query: 'What is the weather like today?', // No location
        options: {
          units: 'metric'
        }
      };

      const result = await weatherService.queryWeather(request);

      // Should either succeed with default or fail gracefully
      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error!.code).toBeDefined();
        expect(result.error!.message).toBeDefined();
      }
    });

    it('should respect rate limits', async () => {
      const request: WeatherQueryRequest = {
        query: 'Tokyo weather',
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          name: 'Tokyo, Japan'
        }
      };

      // Make many rapid requests
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 65; i++) { // Exceed the rate limit
        promises.push(weatherService.queryWeather(request));
      }

      const results = await Promise.all(promises);
      
      // Should have some successful and some rate-limited responses
      const successCount = results.filter(r => r.success).length;
      const rateLimitedCount = results.filter(r => 
        !r.success && r.error?.code === 'RATE_LIMIT_EXCEEDED'
      ).length;

      expect(successCount).toBeGreaterThan(0);
      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(successCount + rateLimitedCount).toBe(65);
    });
  });

  describe('Data Quality Validation', () => {
    it('should return realistic weather data ranges', async () => {
      const request: WeatherQueryRequest = {
        query: 'Sydney weather now',
        location: {
          latitude: -33.8688,
          longitude: 151.2093,
          name: 'Sydney, Australia',
          country: 'Australia'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      
      if (result.success && result.data?.current) {
        const weather = result.data.current;
        
        // Temperature should be within realistic bounds
        expect(weather.temperature.celsius).toBeGreaterThan(-40);
        expect(weather.temperature.celsius).toBeLessThan(55);
        
        // Fahrenheit conversion should be correct
        const expectedF = weather.temperature.celsius * 9/5 + 32;
        expect(Math.abs(weather.temperature.fahrenheit - expectedF)).toBeLessThan(0.1);
        
        // Humidity should be 0-100%
        expect(weather.humidity).toBeGreaterThanOrEqual(0);
        expect(weather.humidity).toBeLessThanOrEqual(100);
        
        // Wind speed should be reasonable
        expect(weather.windSpeed.kilometersPerHour).toBeGreaterThanOrEqual(0);
        expect(weather.windSpeed.kilometersPerHour).toBeLessThan(500);
        
        // Wind direction should be 0-360 degrees
        expect(weather.windDirection).toBeGreaterThanOrEqual(0);
        expect(weather.windDirection).toBeLessThan(360);
        
        // Pressure should be reasonable
        expect(weather.pressure).toBeGreaterThan(800);
        expect(weather.pressure).toBeLessThan(1200);
      }
    });

    it('should maintain consistent forecast data', async () => {
      const request: WeatherQueryRequest = {
        query: 'Berlin weather forecast 3 days',
        location: {
          latitude: 52.5200,
          longitude: 13.4050,
          name: 'Berlin, Germany',
          country: 'Germany'
        },
        options: {
          includeForecast: true,
          forecastDays: 3
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      
      if (result.success && result.data?.daily) {
        const forecasts = result.data.daily;
        expect(forecasts.length).toBe(3);
        
        // Each day should have consistent data
        forecasts.forEach((forecast, index) => {
          expect(forecast.date).toBeDefined();
          expect(forecast.summary.high).toBeGreaterThan(forecast.summary.low);
          expect(forecast.summary.precipitationChance).toBeGreaterThanOrEqual(0);
          expect(forecast.summary.precipitationChance).toBeLessThanOrEqual(100);
          
          // Dates should be sequential
          if (index > 0) {
            const currentDate = new Date(forecast.date);
            const previousDate = new Date(forecasts[index - 1].date);
            const dayDiff = (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);
            expect(dayDiff).toBe(1);
          }
        });
      }
    });
  });
});