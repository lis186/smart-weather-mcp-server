/**
 * Tests for Unicode context validation fixes
 * Ensures international characters work properly
 */

import { ToolHandlerService } from '../../../src/services/tool-handlers';
import { WeatherQuery } from '../../../src/types/index';

describe('Unicode Context Validation', () => {
  describe('Context validation with international characters', () => {
    it('should accept Chinese characters in context', async () => {
      const query: WeatherQuery = {
        query: '天氣查詢',
        context: 'location: 東京, timeframe: 明天'
      };

      // Should not throw validation error
      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should accept Japanese characters in context', async () => {
      const query: WeatherQuery = {
        query: '天気予報',
        context: 'location: 沖縄, activity: サーフィン'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should accept Korean characters in context', async () => {
      const query: WeatherQuery = {
        query: '날씨 예보',
        context: 'location: 서울, timeframe: 내일'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should accept mixed language context', async () => {
      const query: WeatherQuery = {
        query: 'weather forecast',
        context: 'location: 台北 Taipei, timeframe: 明天 tomorrow, activity: 登山 hiking'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should accept complex Unicode characters', async () => {
      const query: WeatherQuery = {
        query: 'météo prévisions',
        context: 'location: Île-de-France, timeframe: après-demain'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should accept emoji in context (user-friendly)', async () => {
      const query: WeatherQuery = {
        query: 'weather',
        context: 'location: Tokyo 🗼, activity: surfing 🏄'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('Context validation security', () => {
    it('should reject HTML tags in context', async () => {
      const query: WeatherQuery = {
        query: 'weather',
        context: 'location: <div>Tokyo</div>'
      };

      await expect(
        ToolHandlerService.handleToolCall('search_weather', query)
      ).rejects.toThrow('Context contains invalid control characters or HTML tags');
    });

    it('should reject control characters in context', async () => {
      const query: WeatherQuery = {
        query: 'weather',
        context: 'location: Tokyo\x00\x01\x02'
      };

      await expect(
        ToolHandlerService.handleToolCall('search_weather', query)
      ).rejects.toThrow('Context contains invalid control characters or HTML tags');
    });

    it('should reject invalid key-value format', async () => {
      const query: WeatherQuery = {
        query: 'weather',
        context: 'this is not key value format'
      };

      await expect(
        ToolHandlerService.handleToolCall('search_weather', query)
      ).rejects.toThrow('Context must be in key-value format');
    });

    it('should accept valid key-value format with Unicode', async () => {
      const query: WeatherQuery = {
        query: 'weather',
        context: 'location: 東京都, timeframe: 明日, preferences: 攝氏溫度'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
    });
  });

  describe('Word length validation', () => {
    it('should accept 200 character words', async () => {
      const longWord = 'https://example.com/very/long/url/path/that/might/be/used/in/weather/queries/' + 'a'.repeat(120);
      const query: WeatherQuery = {
        query: `weather ${longWord}`,
        context: 'location: test'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
    });

    it('should reject words longer than 200 characters', async () => {
      const tooLongWord = 'a'.repeat(201);
      const query: WeatherQuery = {
        query: `weather ${tooLongWord}`,
        context: 'location: test'
      };

      await expect(
        ToolHandlerService.handleToolCall('search_weather', query)
      ).rejects.toThrow('Query contains words longer than 200 characters');
    });

    it('should handle complex technical terms', async () => {
      const query: WeatherQuery = {
        query: 'weather for supercalifragilisticexpialidocious-location-with-very-long-technical-name',
        context: 'location: test'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
    });
  });

  describe('Empty context handling', () => {
    it('should handle empty context after sanitization', async () => {
      const query: WeatherQuery = {
        query: 'weather in Tokyo',
        context: '   '  // Only whitespace
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
      // Context should be undefined after sanitization
    });

    it('should handle no context parameter', async () => {
      const query: WeatherQuery = {
        query: 'weather in Tokyo'
        // No context provided
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content).toBeDefined();
    });
  });
});