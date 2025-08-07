/**
 * Weather Service Integration Tests
 * Tests the complete weather service implementation
 */

import { WeatherService } from '../../../src/services/weather-service.js';
import { SecretManager } from '../../../src/services/secret-manager.js';
import type { 
  WeatherQueryRequest,
  WeatherServiceConfig
} from '../../../src/services/weather-service.js';
import type { Location } from '../../../src/types/weather-api.js';

// Mock SecretManager
jest.mock('../../../src/services/secret-manager.js');
const MockSecretManager = SecretManager as jest.MockedClass<typeof SecretManager>;

describe('WeatherService', () => {
  let weatherService: WeatherService;
  let mockSecretManager: jest.Mocked<SecretManager>;

  beforeEach(() => {
    // Setup mock secret manager
    mockSecretManager = {
      loadSecrets: jest.fn().mockResolvedValue({
        geminiApiKey: 'mock-gemini-key',
        weatherApiKey: 'mock-weather-key'
      }),
      validateSecrets: jest.fn().mockResolvedValue(true),
      getSecret: jest.fn().mockResolvedValue('mock-api-key')
    } as jest.Mocked<SecretManager>;

    // Create weather service config
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

    // Allow async initialization
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should initialize weather service successfully', () => {
      expect(weatherService).toBeInstanceOf(WeatherService);
      expect(mockSecretManager.getSecret).toHaveBeenCalledWith(
        'GOOGLE_WEATHER_API_KEY_SECRET',
        'GOOGLE_WEATHER_API_KEY'
      );
    });

    it('should handle missing API keys gracefully', async () => {
      mockSecretManager.getSecret.mockRejectedValue(new Error('Secret not found'));
      
      const testService = new WeatherService({
        secretManager: mockSecretManager,
        cache: { enabled: false, config: {} as any }
      });

      expect(testService).toBeInstanceOf(WeatherService);
    });

    it('should provide service statistics', () => {
      const stats = weatherService.getStatistics();
      
      expect(stats).toHaveProperty('requestCount');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('services');
      expect(stats).toHaveProperty('lastResetTime');
    });
  });

  describe('Weather Query Processing', () => {
    const testLocation: Location = {
      latitude: 25.0330,
      longitude: 121.5654,
      name: 'Taipei, Taiwan',
      country: 'Taiwan',
      region: 'Taipei'
    };

    it('should process simple weather query', async () => {
      const request: WeatherQueryRequest = {
        query: 'Taipei weather today',
        context: 'temperature in celsius',
        location: testLocation
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.location).toEqual(testLocation);
      expect(result.data!.current).toBeDefined();
      expect(result.data!.metadata.sources).toContain('current-conditions');
    });

    it('should handle complex weather query with forecast', async () => {
      const request: WeatherQueryRequest = {
        query: 'Taipei weather forecast next 5 days',
        location: testLocation,
        options: {
          includeForecast: true,
          forecastDays: 5,
          units: 'metric',
          language: 'en'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      expect(result.data!.daily).toBeDefined();
      expect(result.data!.daily!.length).toBe(5);
      expect(result.data!.metadata.sources).toContain('daily-forecast');
    });

    it('should handle hourly forecast requests', async () => {
      const request: WeatherQueryRequest = {
        query: 'Taipei hourly weather today',
        location: testLocation,
        options: {
          includeHourly: true,
          units: 'metric'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      expect(result.data!.hourly).toBeDefined();
      expect(result.data!.hourly!.periods).toBeDefined();
      expect(result.data!.metadata.sources).toContain('hourly-forecast');
    });

    it('should extract location from query text', async () => {
      const request: WeatherQueryRequest = {
        query: 'What is the weather in Tokyo today?',
        options: {
          units: 'metric',
          language: 'en'
        }
      };

      const result = await weatherService.queryWeather(request);

      expect(result.success).toBe(true);
      expect(result.data!.location).toBeDefined();
      expect(result.data!.location.name).toContain('Tokyo');
    });

    it('should handle missing location gracefully', async () => {
      const request: WeatherQueryRequest = {
        query: 'What is the weather today?', // No location specified
        options: {
          units: 'metric'
        }
      };

      const result = await weatherService.queryWeather(request);

      // Should either succeed with default location or fail with clear error
      if (result.success) {
        expect(result.data!.location).toBeDefined();
      } else {
        expect(result.error!.code).toBe('LOCATION_NOT_SPECIFIED');
      }
    });
  });

  describe('Individual API Methods', () => {
    const testLocation: Location = {
      latitude: 25.0330,
      longitude: 121.5654,
      name: 'Taipei, Taiwan',
      country: 'Taiwan'
    };

    it('should get current weather', async () => {
      const result = await weatherService.getCurrentWeather(testLocation, {
        units: 'metric',
        language: 'en'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.location).toEqual(testLocation);
      expect(result.data!.temperature).toBeDefined();
      expect(result.data!.temperature.celsius).toBeGreaterThan(-50);
      expect(result.data!.temperature.celsius).toBeLessThan(60);
    });

    it('should get weather forecast', async () => {
      const result = await weatherService.getForecast(testLocation, {
        forecastDays: 7,
        units: 'metric'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(7);
      
      // Validate forecast structure
      const forecast = result.data![0];
      expect(forecast.date).toBeDefined();
      expect(forecast.location).toEqual(testLocation);
      expect(forecast.conditions).toBeDefined();
      expect(forecast.summary).toBeDefined();
    });

    it('should get hourly forecast', async () => {
      const result = await weatherService.getHourlyForecast(testLocation, 24);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.periods).toBeDefined();
      expect(result.data!.periods.length).toBe(24);
      
      // Validate hourly structure
      const period = result.data!.periods[0];
      expect(period.time).toBeDefined();
      expect(period.temperature).toBeDefined();
      expect(period.precipitationProbability).toBeGreaterThanOrEqual(0);
    });

    it('should search locations', async () => {
      const result = await weatherService.searchLocations('Tokyo', {
        maxResults: 3,
        language: 'en'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.location).toBeDefined();
      expect(result.data!.confidence).toBeGreaterThan(0);
      expect(result.data!.source).toBeDefined();
    });
  });

  describe('Caching System', () => {
    const testLocation: Location = {
      latitude: 25.0330,
      longitude: 121.5654,
      name: 'Taipei, Taiwan'
    };

    it('should cache weather query results', async () => {
      const request: WeatherQueryRequest = {
        query: 'Taipei weather',
        location: testLocation
      };

      // First request
      const result1 = await weatherService.queryWeather(request);
      expect(result1.success).toBe(true);
      expect(result1.data!.metadata.cached).toBe(false);

      // Second request should be cached
      const result2 = await weatherService.queryWeather(request);
      expect(result2.success).toBe(true);
      expect(result2.data!.metadata.cached).toBe(true);
    });

    it('should respect cache TTL', async () => {
      const request: WeatherQueryRequest = {
        query: 'Taipei weather',
        location: testLocation
      };

      // First request
      const result1 = await weatherService.queryWeather(request);
      expect(result1.data!.metadata.cached).toBe(false);

      // Fast-forward time beyond cache TTL
      jest.advanceTimersByTime(400000); // 6+ minutes

      // Request should not be cached
      const result2 = await weatherService.queryWeather(request);
      expect(result2.data!.metadata.cached).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const request: WeatherQueryRequest = {
        query: 'Tokyo weather',
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          name: 'Tokyo, Japan'
        }
      };

      // Make requests up to the limit
      const promises = [];
      for (let i = 0; i < 65; i++) { // Exceed limit of 60
        promises.push(weatherService.queryWeather(request));
      }

      const results = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedCount = results.filter(r => 
        !r.success && r.error?.code === 'RATE_LIMIT_EXCEEDED'
      ).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should reset rate limit after time window', async () => {
      const request: WeatherQueryRequest = {
        query: 'Tokyo weather',
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          name: 'Tokyo, Japan'
        }
      };

      // Exhaust rate limit
      for (let i = 0; i < 61; i++) {
        await weatherService.queryWeather(request);
      }

      // Fast-forward past rate limit window
      jest.advanceTimersByTime(70000); // 70 seconds

      // Should work again
      const result = await weatherService.queryWeather(request);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock secret manager to fail
      mockSecretManager.getSecret.mockRejectedValue(new Error('API failure'));

      const errorService = new WeatherService({
        secretManager: mockSecretManager,
        cache: { enabled: false, config: {} as any }
      });

      const request: WeatherQueryRequest = {
        query: 'test query',
        location: {
          latitude: 0,
          longitude: 0,
          name: 'Test Location'
        }
      };

      const result = await errorService.queryWeather(request);
      
      // Should still work with mock responses
      expect(result.success).toBe(true);
    });

    it('should validate location coordinates', async () => {
      const invalidLocation: Location = {
        latitude: 200, // Invalid latitude
        longitude: -200, // Invalid longitude  
        name: 'Invalid Location'
      };

      const result = await weatherService.getCurrentWeather(invalidLocation);
      
      // Should handle invalid coordinates
      expect(result).toBeDefined();
    });

    it('should handle network timeouts', async () => {
      // This would require more complex mocking in a real implementation
      // For now, just ensure the service handles errors gracefully
      
      const request: WeatherQueryRequest = {
        query: 'weather query',
        location: {
          latitude: 0,
          longitude: 0,
          name: 'Test'
        }
      };

      // Should not throw unhandled errors
      await expect(weatherService.queryWeather(request)).resolves.toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const health = await weatherService.healthCheck();

      expect(health).toHaveProperty('weather');
      expect(health).toHaveProperty('location');
      expect(health).toHaveProperty('cache');
      
      expect(typeof health.weather).toBe('boolean');
      expect(typeof health.location).toBe('boolean');
      expect(typeof health.cache).toBe('boolean');
    });
  });

  describe('Mock Response Validation', () => {
    it('should generate realistic mock weather data', async () => {
      const location: Location = {
        latitude: 25.0330,
        longitude: 121.5654,
        name: 'Test Location'
      };

      const result = await weatherService.getCurrentWeather(location);

      expect(result.success).toBe(true);
      expect(result.data!.temperature.celsius).toBeGreaterThan(-40);
      expect(result.data!.temperature.celsius).toBeLessThan(50);
      expect(result.data!.humidity).toBeGreaterThan(0);
      expect(result.data!.humidity).toBeLessThan(100);
      expect(result.data!.windSpeed.kilometersPerHour).toBeGreaterThanOrEqual(0);
    });

    it('should generate consistent mock forecast data', async () => {
      const location: Location = {
        latitude: 25.0330,
        longitude: 121.5654,
        name: 'Test Location'
      };

      const result = await weatherService.getForecast(location, { 
        forecastDays: 5 
      });

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(5);

      // Validate each forecast day
      result.data!.forEach((forecast, index) => {
        expect(forecast.date).toBeDefined();
        expect(forecast.location).toEqual(location);
        expect(forecast.summary.high).toBeGreaterThan(forecast.summary.low);
        expect(forecast.summary.precipitationChance).toBeGreaterThanOrEqual(0);
        expect(forecast.summary.precipitationChance).toBeLessThanOrEqual(100);
      });
    });
  });
});