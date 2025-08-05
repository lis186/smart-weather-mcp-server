/**
 * Comprehensive unit tests for Query Router
 * Tests various weather query scenarios and edge cases
 */

import { QueryRouter } from '../src/services/query-router.js';
import { APISelector } from '../src/services/api-selector.js';
import { WeatherErrorHandler } from '../src/utils/error-handler.js';
import { WeatherQuery } from '../src/types/index.js';
import { RoutingContext, ParsedWeatherQuery, RoutingDecision } from '../src/types/routing.js';

// Mock the logger
jest.mock('../src/services/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock the API selector
jest.mock('../src/services/api-selector.js');

describe('QueryRouter', () => {
  let queryRouter: QueryRouter;
  let mockAPISelector: jest.Mocked<APISelector>;
  let mockRoutingContext: RoutingContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock API selector
    mockAPISelector = {
      selectAPI: jest.fn(),
      updateAPIHealth: jest.fn(),
      getAPIHealth: jest.fn(),
      getAvailableAPIs: jest.fn()
    } as any;

    (APISelector as jest.MockedClass<typeof APISelector>).mockImplementation(() => mockAPISelector);

    // Create query router
    queryRouter = new QueryRouter({
      defaultLanguage: 'en',
      defaultUnits: 'metric',
      maxProcessingTime: 2000,
      minConfidenceThreshold: 0.05, // Very low threshold for tests
      enableFallbacks: true,
      apiPriority: ['google_current_conditions', 'google_daily_forecast'],
      caching: {
        enabled: true,
        ttl: 300000,
        maxSize: 100
      }
    });

    // Setup mock routing context
    mockRoutingContext = {
      apiHealth: {
        'google_current_conditions': 'healthy',
        'google_daily_forecast': 'healthy',
        'google_hourly_forecast': 'healthy',
        'google_geocoding': 'healthy'
      },
      responseTimeHistory: {
        'google_current_conditions': [200, 250, 180],
        'google_daily_forecast': [400, 350, 420]
      },
      currentUsage: {},
      cacheStatus: {}
    };
  });

  describe('Basic Query Routing', () => {
    test('should route simple current weather query', async () => {
      const query: WeatherQuery = {
        query: "What's the weather like in Tokyo today?"
      };

      const mockDecision: RoutingDecision = {
        selectedAPI: {
          id: 'google_current_conditions',
          name: 'Google Current Conditions API',
          endpoint: '/maps/api/weather/current',
          category: 'weather',
          supportedIntents: ['current_conditions'],
          requiredParams: ['lat', 'lng'],
          optionalParams: ['units', 'language']
        },
        confidence: 0.9,
        apiParameters: { location: 'Tokyo', units: 'metric' },
        fallbacks: [],
        reasoning: 'High confidence current weather query',
        estimatedResponseTime: 300
      };

      mockAPISelector.selectAPI.mockResolvedValue(mockDecision);

      const result = await queryRouter.routeQuery(query, mockRoutingContext);

      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
      expect(result.decision?.selectedAPI.id).toBe('google_current_conditions');
      expect(result.metadata.parsingConfidence).toBeGreaterThan(0.6);
    });

    test('should route forecast query to daily forecast API', async () => {
      const query: WeatherQuery = {
        query: "Will it rain in London tomorrow?"
      };

      const mockDecision: RoutingDecision = {
        selectedAPI: {
          id: 'google_daily_forecast',
          name: 'Google Daily Forecast API',
          endpoint: '/maps/api/weather/forecast/daily',
          category: 'weather',
          supportedIntents: ['daily_forecast'],
          requiredParams: ['lat', 'lng'],
          optionalParams: ['units', 'language', 'forecast_days']
        },
        confidence: 0.85,
        apiParameters: { location: 'London', units: 'metric', forecast_days: 1 },
        fallbacks: [],
        reasoning: 'Forecast query with precipitation focus',
        estimatedResponseTime: 400
      };

      mockAPISelector.selectAPI.mockResolvedValue(mockDecision);

      const result = await queryRouter.routeQuery(query, mockRoutingContext);

      expect(result.success).toBe(true);
      expect(result.decision?.selectedAPI.id).toBe('google_daily_forecast');
    });

    test('should route hourly forecast query', async () => {
      const query: WeatherQuery = {
        query: "Hourly weather forecast for New York this afternoon",
        context: "location: New York, timeframe: 6 hours"
      };

      const mockDecision: RoutingDecision = {
        selectedAPI: {
          id: 'google_hourly_forecast',
          name: 'Google Hourly Forecast API',
          endpoint: '/maps/api/weather/forecast/hourly',
          category: 'weather',
          supportedIntents: ['hourly_forecast'],
          requiredParams: ['lat', 'lng'],
          optionalParams: ['units', 'language', 'forecast_hours']
        },
        confidence: 0.9,
        apiParameters: { location: 'New York', units: 'metric', forecast_hours: 6 },
        fallbacks: [],
        reasoning: 'Explicit hourly forecast request',
        estimatedResponseTime: 500
      };

      mockAPISelector.selectAPI.mockResolvedValue(mockDecision);

      const result = await queryRouter.routeQuery(query, mockRoutingContext);

      expect(result.success).toBe(true);
      expect(result.decision?.selectedAPI.id).toBe('google_hourly_forecast');
    });
  });

  describe('Query Parsing', () => {
    test('should extract location from query text', async () => {
      const query: WeatherQuery = {
        query: "What's the temperature in Paris, France today?"
      };

      mockAPISelector.selectAPI.mockResolvedValue({
        selectedAPI: expect.any(Object),
        confidence: 0.8,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      });

      await queryRouter.routeQuery(query, mockRoutingContext);

      // Verify that selectAPI was called with parsed query containing Paris
      const calledWith = mockAPISelector.selectAPI.mock.calls[0][0] as ParsedWeatherQuery;
      expect(calledWith.location.name).toBe('Paris, France');
    });

    test('should detect weather metrics from query', async () => {
      const query: WeatherQuery = {
        query: "What's the humidity and wind speed in Seattle?"
      };

      mockAPISelector.selectAPI.mockResolvedValue({
        selectedAPI: expect.any(Object),
        confidence: 0.8,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      });

      await queryRouter.routeQuery(query, mockRoutingContext);

      const calledWith = mockAPISelector.selectAPI.mock.calls[0][0] as ParsedWeatherQuery;
      expect(calledWith.dataPreferences.metrics).toContain('humidity');
      expect(calledWith.dataPreferences.metrics).toContain('wind');
    });

    test('should detect imperial units', async () => {
      const query: WeatherQuery = {
        query: "What's the temperature in Fahrenheit in Miami?"
      };

      mockAPISelector.selectAPI.mockResolvedValue({
        selectedAPI: expect.any(Object),
        confidence: 0.8,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      });

      await queryRouter.routeQuery(query, mockRoutingContext);

      const calledWith = mockAPISelector.selectAPI.mock.calls[0][0] as ParsedWeatherQuery;
      expect(calledWith.dataPreferences.units).toBe('imperial');
    });

    test('should detect historical queries', async () => {
      const query: WeatherQuery = {
        query: "What was the weather like yesterday in Boston?"
      };

      mockAPISelector.selectAPI.mockResolvedValue({
        selectedAPI: expect.any(Object),
        confidence: 0.8,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      });

      await queryRouter.routeQuery(query, mockRoutingContext);

      const calledWith = mockAPISelector.selectAPI.mock.calls[0][0] as ParsedWeatherQuery;
      expect(calledWith.timeframe.type).toBe('historical');
    });
  });

  describe('Error Handling', () => {
    test('should handle low confidence parsing', async () => {
      const query: WeatherQuery = {
        query: "asdfg hjkl" // Nonsensical query
      };

      const result = await queryRouter.routeQuery(query, mockRoutingContext);

      expect(result.success).toBe(false);
      // With very low confidence threshold, this may reach API selector and fail there
      expect(['PARSING_FAILED', 'NO_SUITABLE_API']).toContain(result.error?.type);
      expect(result.error?.retryable).toBe(true);
    });

    test('should handle API selector errors', async () => {
      const query: WeatherQuery = {
        query: "What's the weather in Tokyo?"
      };

      mockAPISelector.selectAPI.mockRejectedValue(new Error('API selection failed'));

      const result = await queryRouter.routeQuery(query, mockRoutingContext);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('NO_SUITABLE_API');
    });

    test('should handle missing location gracefully', async () => {
      const query: WeatherQuery = {
        query: "What's the weather?" // No location specified
      };

      mockAPISelector.selectAPI.mockResolvedValue({
        selectedAPI: expect.any(Object),
        confidence: 0.8,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      });

      const result = await queryRouter.routeQuery(query, mockRoutingContext);

      // Should still succeed but with lower confidence location
      expect(result.success).toBe(true);
      const calledWith = mockAPISelector.selectAPI.mock.calls[0][0] as ParsedWeatherQuery;
      expect(calledWith.location.confidence).toBeLessThan(0.5);
    });
  });

  describe('Fallback Handling', () => {
    test('should handle fallback when primary API fails', async () => {
      const originalDecision: RoutingDecision = {
        selectedAPI: {
          id: 'google_current_conditions',
          name: 'Google Current Conditions API',
          endpoint: '/maps/api/weather/current',
          category: 'weather',
          supportedIntents: ['current_conditions'],
          requiredParams: ['lat', 'lng'],
          optionalParams: ['units', 'language']
        },
        confidence: 0.9,
        apiParameters: {},
        fallbacks: [{
          id: 'google_daily_forecast',
          name: 'Google Daily Forecast API',
          endpoint: '/maps/api/weather/forecast/daily',
          category: 'weather',
          supportedIntents: ['daily_forecast'],
          requiredParams: ['lat', 'lng'],
          optionalParams: ['units', 'language']
        }],
        reasoning: 'Primary choice',
        estimatedResponseTime: 300
      };

      const error = new Error('Primary API failed');

      const fallbackResult = await queryRouter.handleFallback(
        { success: true, decision: originalDecision, metadata: { processingTime: 100, parsingConfidence: 0.9, fallbacksConsidered: 1 } },
        mockRoutingContext,
        error
      );

      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.decision?.selectedAPI.id).toBe('google_daily_forecast');
      expect(fallbackResult.decision?.confidence).toBeLessThan(originalDecision.confidence);
    });

    test('should fail when no fallbacks available', async () => {
      const originalDecision: RoutingDecision = {
        selectedAPI: {
          id: 'google_current_conditions',
          name: 'Google Current Conditions API',
          endpoint: '/maps/api/weather/current',
          category: 'weather',
          supportedIntents: ['current_conditions'],
          requiredParams: ['lat', 'lng'],
          optionalParams: ['units', 'language']
        },
        confidence: 0.9,
        apiParameters: {},
        fallbacks: [], // No fallbacks
        reasoning: 'Primary choice',
        estimatedResponseTime: 300
      };

      const error = new Error('Primary API failed');

      const fallbackResult = await queryRouter.handleFallback(
        { success: true, decision: originalDecision, metadata: { processingTime: 100, parsingConfidence: 0.9, fallbacksConsidered: 0 } },
        mockRoutingContext,
        error
      );

      expect(fallbackResult.success).toBe(false);
      expect(fallbackResult.error?.type).toBe('API_UNAVAILABLE');
    });

    test('should skip unavailable fallback APIs', async () => {
      const originalDecision: RoutingDecision = {
        selectedAPI: {
          id: 'google_current_conditions',
          name: 'Google Current Conditions API',
          endpoint: '/maps/api/weather/current',
          category: 'weather',
          supportedIntents: ['current_conditions'],
          requiredParams: ['lat', 'lng'],
          optionalParams: ['units', 'language']
        },
        confidence: 0.9,
        apiParameters: {},
        fallbacks: [
          {
            id: 'google_daily_forecast',
            name: 'Google Daily Forecast API',
            endpoint: '/maps/api/weather/forecast/daily',
            category: 'weather',
            supportedIntents: ['daily_forecast'],
            requiredParams: ['lat', 'lng'],
            optionalParams: ['units', 'language']
          },
          {
            id: 'google_hourly_forecast',
            name: 'Google Hourly Forecast API',
            endpoint: '/maps/api/weather/forecast/hourly',
            category: 'weather',
            supportedIntents: ['hourly_forecast'],
            requiredParams: ['lat', 'lng'],
            optionalParams: ['units', 'language']
          }
        ],
        reasoning: 'Primary choice',
        estimatedResponseTime: 300
      };

      // Mark first fallback as unavailable
      const contextWithUnavailableAPI = {
        ...mockRoutingContext,
        apiHealth: {
          ...mockRoutingContext.apiHealth,
          'google_daily_forecast': 'unavailable' as const
        }
      };

      const error = new Error('Primary API failed');

      const fallbackResult = await queryRouter.handleFallback(
        { success: true, decision: originalDecision, metadata: { processingTime: 100, parsingConfidence: 0.9, fallbacksConsidered: 2 } },
        contextWithUnavailableAPI,
        error
      );

      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.decision?.selectedAPI.id).toBe('google_hourly_forecast');
    });
  });

  describe('Caching', () => {
    test('should cache successful routing results', async () => {
      const query: WeatherQuery = {
        query: "Weather in Tokyo"
      };

      const mockDecision: RoutingDecision = {
        selectedAPI: expect.any(Object),
        confidence: 0.9,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      };

      mockAPISelector.selectAPI.mockResolvedValue(mockDecision);

      // First call
      await queryRouter.routeQuery(query, mockRoutingContext);
      
      // Second call should use cache
      await queryRouter.routeQuery(query, mockRoutingContext);

      // API selector should only be called once
      expect(mockAPISelector.selectAPI).toHaveBeenCalledTimes(1);
    });

    test('should respect cache TTL', async () => {
      const shortTTLRouter = new QueryRouter({
        caching: {
          enabled: true,
          ttl: 1, // 1ms TTL
          maxSize: 100
        }
      });

      const query: WeatherQuery = {
        query: "Weather in Tokyo"
      };

      const mockDecision: RoutingDecision = {
        selectedAPI: expect.any(Object),
        confidence: 0.9,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      };

      mockAPISelector.selectAPI.mockResolvedValue(mockDecision);

      // First call
      await shortTTLRouter.routeQuery(query, mockRoutingContext);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Second call should not use cache
      await shortTTLRouter.routeQuery(query, mockRoutingContext);

      expect(mockAPISelector.selectAPI).toHaveBeenCalledTimes(2);
    });

    test('should handle cache size limits', async () => {
      const smallCacheRouter = new QueryRouter({
        caching: {
          enabled: true,
          ttl: 60000,
          maxSize: 2
        }
      });

      const queries = [
        { query: "Weather in Tokyo" },
        { query: "Weather in London" },
        { query: "Weather in Paris" }
      ];

      const mockDecision: RoutingDecision = {
        selectedAPI: expect.any(Object),
        confidence: 0.9,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      };

      mockAPISelector.selectAPI.mockResolvedValue(mockDecision);

      // Fill cache beyond limit
      for (const query of queries) {
        await smallCacheRouter.routeQuery(query, mockRoutingContext);
      }

      // First query should be evicted, so it should call API selector again
      await smallCacheRouter.routeQuery(queries[0], mockRoutingContext);

      expect(mockAPISelector.selectAPI).toHaveBeenCalledTimes(4); // 3 + 1 for evicted
    });
  });

  describe('Configuration', () => {
    test('should use provided configuration', () => {
      const customConfig = {
        defaultLanguage: 'es',
        defaultUnits: 'imperial' as const,
        minConfidenceThreshold: 0.7
      };

      const customRouter = new QueryRouter(customConfig);
      const config = customRouter.getConfig();

      expect(config.defaultLanguage).toBe('es');
      expect(config.defaultUnits).toBe('imperial');
      expect(config.minConfidenceThreshold).toBe(0.7);
    });

    test('should update configuration', () => {
      const updates = {
        minConfidenceThreshold: 0.8,
        enableFallbacks: false
      };

      queryRouter.updateConfig(updates);
      const config = queryRouter.getConfig();

      expect(config.minConfidenceThreshold).toBe(0.8);
      expect(config.enableFallbacks).toBe(false);
    });

    test('should provide cache statistics', () => {
      const stats = queryRouter.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('ttl');
    });

    test('should clear cache', async () => {
      const query: WeatherQuery = {
        query: "Weather in Tokyo"
      };

      mockAPISelector.selectAPI.mockResolvedValue({
        selectedAPI: expect.any(Object),
        confidence: 0.9,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      });

      // Cache a result
      await queryRouter.routeQuery(query, mockRoutingContext);
      
      // Clear cache
      queryRouter.clearCache();
      
      // Should call API selector again
      await queryRouter.routeQuery(query, mockRoutingContext);

      expect(mockAPISelector.selectAPI).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty query', async () => {
      const query: WeatherQuery = {
        query: ""
      };

      const result = await queryRouter.routeQuery(query, mockRoutingContext);

      expect(result.success).toBe(false);
      // With very low confidence threshold, this may reach API selector and fail there
      expect(['PARSING_FAILED', 'NO_SUITABLE_API']).toContain(result.error?.type);
    });

    test('should handle very long query', async () => {
      const query: WeatherQuery = {
        query: "a".repeat(2000) // Very long query
      };

      mockAPISelector.selectAPI.mockResolvedValue({
        selectedAPI: expect.any(Object),
        confidence: 0.8,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      });

      const result = await queryRouter.routeQuery(query, mockRoutingContext);

      // Should truncate query but still process
      expect(result.success).toBe(true);
      const calledWith = mockAPISelector.selectAPI.mock.calls[0][0] as ParsedWeatherQuery;
      // Note: query is truncated in tool-handlers.ts before reaching the router
      expect(calledWith.originalQuery).toBe("a".repeat(2000)); // Router gets the full original query
    });

    test('should handle special characters in query', async () => {
      const query: WeatherQuery = {
        query: "What's the weather in São Paulo, Brazil today?"
      };

      mockAPISelector.selectAPI.mockResolvedValue({
        selectedAPI: expect.any(Object),
        confidence: 0.8,
        apiParameters: {},
        fallbacks: [],
        reasoning: 'test',
        estimatedResponseTime: 300
      });

      const result = await queryRouter.routeQuery(query, mockRoutingContext);

      expect(result.success).toBe(true);
      const calledWith = mockAPISelector.selectAPI.mock.calls[0][0] as ParsedWeatherQuery;
      expect(calledWith.location.name).toContain('São Paulo');
    });
  });
});

describe('WeatherErrorHandler', () => {
  describe('Error Handling', () => {
    test('should handle routing errors with suggestions', () => {
      const error = WeatherErrorHandler.handleError('LOCATION_NOT_FOUND', {
        query: 'Weather in Atlantis',
        location: 'Atlantis'
      });

      expect(error.message).toContain('Atlantis');
      expect(error.suggestions.some(s => s.includes('country'))).toBe(true);
      expect(error.retryable).toBe(true);
      expect(error.severity).toBe('low');
    });

    test('should handle API errors with status codes', () => {
      const apiError = {
        status: 429,
        message: 'Too Many Requests'
      };

      const error = WeatherErrorHandler.handleError(apiError);

      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryable).toBe(true);
      expect(error.suggestions.some(s => s.toLowerCase().includes('wait'))).toBe(true);
    });

    test('should handle network errors', () => {
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };

      const error = WeatherErrorHandler.handleError(networkError);

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.severity).toBe('high');
      expect(error.suggestions.some(s => s.includes('connection'))).toBe(true);
    });

    test('should format error for user display', () => {
      const userError = WeatherErrorHandler.handleError('LOCATION_NOT_FOUND', {
        location: 'Atlantis'
      });

      const formatted = WeatherErrorHandler.formatForUser(userError);

      expect(formatted).toContain(userError.message);
      expect(formatted).toContain('Suggestions:');
      expect(formatted).toContain('1. ');
      expect(formatted).toContain('try this request again');
    });

    test('should convert to MCP error', () => {
      const userError = WeatherErrorHandler.handleError('INVALID_PARAMETERS');
      const mcpError = WeatherErrorHandler.toMCPError(userError);

      expect(mcpError.code).toBeDefined();
      expect(mcpError.message).toContain(userError.message);
    });
  });
});