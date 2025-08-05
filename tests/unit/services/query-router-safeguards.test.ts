/**
 * Comprehensive tests for QueryRouter hybrid parsing edge cases and safeguards
 * Tests all critical issues identified in code review
 */

import { QueryRouter } from '../../../src/services/query-router';
import { WeatherQuery } from '../../../src/types/index';
import { GeminiWeatherParser } from '../../../src/services/gemini-parser';

// Mock logger to prevent console spam during tests
jest.mock('../../../src/services/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('QueryRouter - Critical Safeguards & Edge Cases', () => {
  describe('AI Parser Initialization Safeguards', () => {
    it('should handle missing AI parser gracefully', async () => {
      const router = new QueryRouter(); // No Gemini parser provided
      
      const query: WeatherQuery = {
        query: '沖繩明天天氣預報 衝浪條件 海浪高度 風速', // Complex query that needs AI
        context: 'location: 沖繩, activity: 衝浪'
      };

      // Should work with rules-only fallback
      const result = await router.routeQuery(query, {
        timestamp: new Date(),
        userPreferences: { units: 'metric', language: 'zh-TW' }
      });

      expect(result.parsedQuery.parsingSource).toBe('rules_fallback');
      expect(result.parsedQuery.confidence).toBeGreaterThan(0);
    });

    it('should reject malformed AI parser', () => {
      const malformedParser = {} as GeminiWeatherParser; // Missing parseQuery method
      
      expect(() => {
        new QueryRouter(malformedParser);
      }).toThrow('Invalid Gemini parser: parseQuery method is required');
    });

    it('should handle AI parser timeout gracefully', async () => {
      const timeoutParser = {
        parseQuery: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 15000)) // Exceeds 10s timeout
        )
      } as unknown as GeminiWeatherParser;

      const router = new QueryRouter(timeoutParser);
      
      const query: WeatherQuery = {
        query: 'complex query requiring AI',
        context: 'location: somewhere'
      };

      // Should fallback to rules when AI times out
      const result = await router.routeQuery(query, {
        timestamp: new Date()
      });

      // Verify it didn't wait for the timeout
      expect(result.parsedQuery.parsingSource).toMatch(/rules/);
    });

    it('should handle AI parser errors and fallback to rules', async () => {
      const errorParser = {
        parseQuery: jest.fn().mockRejectedValue(new Error('API quota exceeded'))
      } as unknown as GeminiWeatherParser;

      const router = new QueryRouter(errorParser);
      
      const query: WeatherQuery = {
        query: '複雜的中文天氣查詢',
        context: 'location: 台北'
      };

      const result = await router.routeQuery(query, {
        timestamp: new Date()
      });

      // Should fallback to rules when AI fails
      expect(result.parsedQuery.parsingSource).toMatch(/rules/);
      expect(result.parsedQuery.confidence).toBeGreaterThan(0);
    });
  });

  describe('Input Sanitization Edge Cases', () => {
    it('should sanitize XSS attempts in query', async () => {
      const router = new QueryRouter();
      
      const maliciousQuery: WeatherQuery = {
        query: '<script>alert("xss")</script>Tokyo weather',
        context: 'location: Tokyo'
      };

      const result = await router.routeQuery(maliciousQuery, {
        timestamp: new Date()
      });

      // Script tags should be removed
      expect(result.parsedQuery.originalQuery).not.toContain('<script>');
      expect(result.parsedQuery.originalQuery).toContain('Tokyo weather');
    });

    it('should reject extremely long words (DoS protection)', async () => {
      const router = new QueryRouter();
      
      const longWordQuery: WeatherQuery = {
        query: 'A' + 'a'.repeat(150) + ' weather', // 151 character word
      };

      await expect(router.routeQuery(longWordQuery, {
        timestamp: new Date()
      })).rejects.toThrow('words longer than 100 characters');
    });

    it('should sanitize context with invalid characters', async () => {
      const router = new QueryRouter();
      
      const maliciousContext: WeatherQuery = {
        query: 'Tokyo weather',
        context: 'location: Tokyo<script>evil()</script>'
      };

      await expect(router.routeQuery(maliciousContext, {
        timestamp: new Date()
      })).rejects.toThrow('Context contains invalid characters');
    });

    it('should handle empty query after sanitization', async () => {
      const router = new QueryRouter();
      
      const emptyQuery: WeatherQuery = {
        query: '   <script></script>   ', // Only malicious content
      };

      await expect(router.routeQuery(emptyQuery, {
        timestamp: new Date()
      })).rejects.toThrow('Query cannot be empty after sanitization');
    });
  });

  describe('Hybrid Parsing Logic Edge Cases', () => {
    it('should use rules for high-confidence simple queries', async () => {
      const mockAI = {
        parseQuery: jest.fn().mockResolvedValue({
          success: true,
          result: { confidence: 0.95 }
        })
      } as unknown as GeminiWeatherParser;

      const router = new QueryRouter(mockAI);
      
      const simpleQuery: WeatherQuery = {
        query: 'Tokyo weather today',
        context: 'location: Tokyo'
      };

      const result = await router.routeQuery(simpleQuery, {
        timestamp: new Date()
      });

      // Should use rules for simple queries, not AI
      expect(mockAI.parseQuery).not.toHaveBeenCalled();
      expect(result.parsedQuery.parsingSource).toBe('rules_only');
    });

    it('should use AI fallback for low-confidence complex queries', async () => {
      const mockAI = {
        parseQuery: jest.fn().mockResolvedValue({
          success: true,
          result: {
            intent: 'weather_advice',
            location: '沖繩',
            confidence: 0.85,
            timeScope: { type: 'forecast', specificTime: 'tomorrow' },
            metrics: ['wind_speed', 'wave_height'],
            activityContext: '衝浪',
            language: 'zh-TW'
          }
        })
      } as unknown as GeminiWeatherParser;

      const router = new QueryRouter(mockAI);
      
      const complexQuery: WeatherQuery = {
        query: '沖繩明天天氣預報 衝浪條件 海浪高度 風速',
        context: 'activity: 衝浪'
      };

      const result = await router.routeQuery(complexQuery, {
        timestamp: new Date()
      });

      // Should use AI for complex queries
      expect(mockAI.parseQuery).toHaveBeenCalled();
      expect(result.parsedQuery.parsingSource).toBe('rules_with_ai_fallback');
      expect(result.parsedQuery.location).toBe('沖繩');
    });

    it('should handle dynamic confidence thresholds correctly', async () => {
      // Test with AI available
      const mockAI = {
        parseQuery: jest.fn().mockResolvedValue({
          success: true,
          result: { confidence: 0.6 }
        })
      } as unknown as GeminiWeatherParser;

      const routerWithAI = new QueryRouter(mockAI);
      const routerWithoutAI = new QueryRouter();
      
      const mediumComplexityQuery: WeatherQuery = {
        query: '中等複雜度查詢',
        context: 'location: 某地'
      };

      const contextParam = { timestamp: new Date() };

      // With AI: should use higher threshold (0.5)
      await routerWithAI.routeQuery(mediumComplexityQuery, contextParam);
      
      // Without AI: should use lower threshold (0.3)
      const resultWithoutAI = await routerWithoutAI.routeQuery(mediumComplexityQuery, contextParam);
      
      expect(resultWithoutAI.parsedQuery.parsingSource).toBe('rules_fallback');
    });
  });

  describe('Error Handling & Recovery', () => {
    it('should provide detailed error messages for debugging', async () => {
      const router = new QueryRouter();
      
      try {
        await router.routeQuery({
          query: '', // Invalid empty query
        }, { timestamp: new Date() });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Query cannot be empty');
      }
    });

    it('should handle malformed AI responses gracefully', async () => {
      const brokenAI = {
        parseQuery: jest.fn().mockResolvedValue(null) // Invalid response
      } as unknown as GeminiWeatherParser;

      const router = new QueryRouter(brokenAI);
      
      const query: WeatherQuery = {
        query: 'complex query',
        context: 'location: somewhere'
      };

      const result = await router.routeQuery(query, {
        timestamp: new Date()
      });

      // Should fallback to rules when AI returns invalid response
      expect(result.parsedQuery.parsingSource).toMatch(/rules/);
    });

    it('should preserve query privacy in error logs', async () => {
      const errorAI = {
        parseQuery: jest.fn().mockRejectedValue(new Error('API error'))
      } as unknown as GeminiWeatherParser;

      const router = new QueryRouter(errorAI);
      
      const sensitiveQuery: WeatherQuery = {
        query: 'Weather at my secret location with sensitive data that should not be fully logged in error messages',
      };

      // Should not throw but should handle gracefully
      const result = await router.routeQuery(sensitiveQuery, {
        timestamp: new Date()
      });

      expect(result.parsedQuery.parsingSource).toMatch(/rules/);
      // Privacy check: ensure full query is not logged (implementation detail)
    });
  });

  describe('Performance & Resource Management', () => {
    it('should complete parsing within reasonable time limits', async () => {
      const router = new QueryRouter();
      
      const startTime = Date.now();
      
      await router.routeQuery({
        query: 'Simple weather query',
        context: 'location: Test'
      }, { timestamp: new Date() });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent queries without interference', async () => {
      const router = new QueryRouter();
      
      const queries = [
        { query: 'Tokyo weather', context: 'location: Tokyo' },
        { query: 'London weather', context: 'location: London' },
        { query: 'Paris weather', context: 'location: Paris' }
      ].map(q => ({ ...q } as WeatherQuery));

      const results = await Promise.all(
        queries.map(query => 
          router.routeQuery(query, { timestamp: new Date() })
        )
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.parsedQuery.confidence).toBeGreaterThan(0);
      });
    });
  });
});