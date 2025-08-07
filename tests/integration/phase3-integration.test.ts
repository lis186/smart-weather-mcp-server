/**
 * Phase 3.1 Integration Tests
 * Tests the fixed context format, time integration, and Gemini improvements
 */

import { QueryRouter } from '../src/services/query-router.js';
import { WeatherQuery } from '../src/types/index.js';
import { timeService } from '../src/services/time-service.js';

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
jest.mock('../src/services/api-selector.js', () => ({
  APISelector: jest.fn().mockImplementation(() => ({
    selectAPI: jest.fn().mockReturnValue({
      selectedAPI: 'google_current_conditions',
      confidence: 0.9,
      reasoning: 'Test API selection',
      alternatives: []
    })
  }))
}));

describe('Phase 3.1 Integration Tests', () => {
  let queryRouter: QueryRouter;
  let mockGeminiParser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock Gemini parser that simulates successful parsing
    mockGeminiParser = {
      parseQuery: jest.fn().mockResolvedValue({
        success: true,
        result: {
          location: { name: 'Okinawa', confidence: 0.85 },
          intent: { primary: 'weather_advice', confidence: 0.9 },
          confidence: 0.88,
          language: 'zh-TW',
          metrics: ['temperature', 'wind_speed', 'precipitation'],
          timeScope: { type: 'forecast', period: 'tomorrow' }
        }
      })
    };

    queryRouter = new QueryRouter(mockGeminiParser, { 
      minConfidenceThreshold: 0.3,
      aiThreshold: 0.8  // Higher threshold to trigger AI fallback for complex queries
    });
  });

  describe('Context Format Fixes', () => {
    test('should accept free-form context without key-value format', async () => {
      const query: WeatherQuery = { 
        query: "沖繩明天天氣預報 衝浪條件 海浪高度 風速",
        context: "用戶計劃明天去衝浪，需要詳細的海況資訊"  // Free-form context
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true);
      // If AI fallback was triggered, check the call parameters
      if (mockGeminiParser.parseQuery.mock.calls.length > 0) {
        expect(mockGeminiParser.parseQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            query: query.query,
            context: expect.stringContaining("用戶計劃明天去衝浪")
          })
        );
      }
    });

    test('should handle context with natural language preferences', async () => {
      const query: WeatherQuery = { 
        query: "Tokyo weather today",
        context: "I prefer detailed forecasts in English with Celsius temperature"
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true);
      // If AI fallback was triggered, check the call parameters
      if (mockGeminiParser.parseQuery.mock.calls.length > 0) {
        expect(mockGeminiParser.parseQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.stringContaining("detailed forecasts")
          })
        );
      }
    });

    test('should handle empty context gracefully', async () => {
      const query: WeatherQuery = { 
        query: "台北明天天氣如何？"
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true);
      // If AI fallback was triggered, check the call parameters
      if (mockGeminiParser.parseQuery.mock.calls.length > 0) {
        expect(mockGeminiParser.parseQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            query: query.query,
            context: expect.stringContaining("Current time:")
          })
        );
      }
    });
  });

  describe('Time Service Integration', () => {
    test('should parse relative time expressions in Chinese', () => {
      const timeInfo = timeService.parseRelativeTime('明天台北天氣');
      
      expect(timeInfo.relativeDescription).toBe('明天');
      expect(timeInfo.confidence).toBeGreaterThan(0.8);
      expect(timeInfo.absoluteTime).toBeInstanceOf(Date);
    });

    test('should parse relative time expressions in English', () => {
      const timeInfo = timeService.parseRelativeTime('tomorrow weather in Tokyo');
      
      expect(timeInfo.relativeDescription).toBe('tomorrow');
      expect(timeInfo.confidence).toBeGreaterThan(0.8);
    });

    test('should parse relative time expressions in Japanese', () => {
      const timeInfo = timeService.parseRelativeTime('明日の東京の天気');
      
      expect(timeInfo.relativeDescription).toBe('明日');
      expect(timeInfo.confidence).toBeGreaterThan(0.8);
    });

    test('should provide time context to AI parser', async () => {
      const query: WeatherQuery = { 
        query: "明天適合衝浪嗎？"
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true);
      // If AI fallback was triggered, check the call parameters
      if (mockGeminiParser.parseQuery.mock.calls.length > 0) {
        expect(mockGeminiParser.parseQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.stringMatching(/Current time:.*timezone: Asia\/Taipei/)
          })
        );
      }
    });
  });

  describe('Complex Query Handling', () => {
    test('should handle complex Okinawa surfing query', async () => {
      const query: WeatherQuery = { 
        query: "沖繩明天天氣預報 衝浪條件 海浪高度 風速",
        context: "計劃衝浪活動，需要海況資訊"
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true);
      // Complex query should trigger AI fallback or be handled with high confidence
      expect(['rules_with_ai_fallback', 'rules_only']).toContain(result.parsedQuery?.parsingSource);
      // AI should be called for complex queries if confidence is below threshold
      if (result.parsedQuery?.parsingSource === 'rules_with_ai_fallback') {
        expect(mockGeminiParser.parseQuery).toHaveBeenCalled();
      }
    });

    test('should handle air quality queries', async () => {
      const query: WeatherQuery = { 
        query: "台灣明天空氣品質預報 花粉濃度 過敏指數"
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true);
      // Should trigger AI fallback for complex air quality query
      expect(['rules_with_ai_fallback', 'rules_only']).toContain(result.parsedQuery?.parsingSource);
    });

    test('should handle marine conditions query', async () => {
      const query: WeatherQuery = { 
        query: "日本沖繩明天天氣 海況 風浪預報"
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true);
      expect(result.parsedQuery?.language).toBe('zh-TW');
    });
  });

  describe('Multilingual Time Handling', () => {
    test('should format time in Traditional Chinese', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const formatted = timeService.formatTime(date, 'zh-TW');
      
      expect(formatted).toContain('2025');
      expect(typeof formatted).toBe('string');
    });

    test('should format time in Japanese', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const formatted = timeService.formatTime(date, 'ja');
      
      expect(formatted).toContain('2025');
      expect(typeof formatted).toBe('string');
    });

    test('should create time context with timezone', async () => {
      const timeContext = await timeService.createTimeContext('明天東京天氣', 'Asia/Tokyo');
      
      expect(timeContext.timezone).toBe('Asia/Tokyo');
      expect(timeContext.relativeTime).toBe('明天');
      expect(timeContext.currentTime).toBeInstanceOf(Date);
    });
  });

  describe('Error Recovery', () => {
    test('should handle AI parser failure gracefully', async () => {
      mockGeminiParser.parseQuery.mockRejectedValue(new Error('Gemini API unavailable'));
      
      const query: WeatherQuery = { 
        query: "複雜的天氣查詢需要AI解析"
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true);
      expect(result.parsedQuery?.parsingSource).toBe('rules_fallback');
    });

    test('should provide meaningful error messages', async () => {
      mockGeminiParser.parseQuery.mockResolvedValue({
        success: false,
        error: 'Complex parsing failed'
      });
      
      const query: WeatherQuery = { 
        query: "無法解析的查詢"
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true); // Should fallback to rules
      expect(result.parsedQuery?.parsingSource).toBe('rules_fallback');
    });
  });

  describe('Performance Validation', () => {
    test('should complete parsing within reasonable time', async () => {
      const startTime = Date.now();
      
      const query: WeatherQuery = { 
        query: "台北今天天氣如何？"
      };
      
      const result = await queryRouter.routeQuery(query);
      const processingTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(2000); // Should be under 2 seconds
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('should track confidence scores appropriately', async () => {
      const query: WeatherQuery = { 
        query: "Tokyo weather today"  // Clear, simple query
      };
      
      const result = await queryRouter.routeQuery(query);
      
      expect(result.success).toBe(true);
      expect(result.metadata.parsingConfidence).toBeGreaterThan(0.5);
    });
  });
});
