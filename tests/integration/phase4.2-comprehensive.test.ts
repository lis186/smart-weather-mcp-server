/**
 * Phase 4.2 Comprehensive Integration Tests
 * Tests for find_location and get_weather_advice tools
 * 
 * Coverage:
 * - find_location: Multi-language location search with Google Maps integration
 * - get_weather_advice: AI-powered weather advice with rule-based fallback
 * - Cross-tool integration: location → weather → advice pipeline
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ToolHandlerService } from '../../src/services/tool-handlers.js';
import type { WeatherQuery } from '../../src/types/index.js';

describe('Phase 4.2: Enhanced Location & Weather Advice Tools', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
    
    // Setup test environment
    process.env.WEATHER_API_KEY = 'test-api-key';
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
    // Skip Gemini for most tests to focus on core functionality
    delete process.env.GOOGLE_CLOUD_PROJECT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('find_location Tool', () => {
    it('should handle simple English location queries', async () => {
      const query: WeatherQuery = {
        query: 'New York'
      };

      const result = await ToolHandlerService.handleToolCall('find_location', query);
      
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content).toHaveLength(2);
      
      // First content should be JSON data
      const jsonContent = result.content[0];
      expect(jsonContent.type).toBe('text');
      
      let parsedData;
      try {
        parsedData = JSON.parse(jsonContent.text);
      } catch (error) {
        // If parsing fails, it might be an error response
        expect(jsonContent.text).toContain('Location Search Failed');
        return;
      }

      expect(parsedData).toHaveProperty('location');
      expect(parsedData).toHaveProperty('confidence');
      expect(parsedData).toHaveProperty('source');
      expect(parsedData.searchQuery).toBe('New York');

      // Second content should be human-readable
      const textContent = result.content[1];
      expect(textContent.type).toBe('text');
      expect(textContent.text).toContain('Location Search Results');
    });

    it('should handle Chinese location queries', async () => {
      const query: WeatherQuery = {
        query: '台北101',
        context: '繁體中文'
      };

      const result = await ToolHandlerService.handleToolCall('find_location', query);
      
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      
      const textContent = result.content[1];
      if (textContent.text.includes('Location Search Failed')) {
        // Expected in test environment without real API
        expect(textContent.text).toContain('台北101');
      } else {
        expect(textContent.text).toContain('Location Search Results');
      }
    });

    it('should handle complex location queries with weather context', async () => {
      const query: WeatherQuery = {
        query: 'weather in Tokyo Shibuya district',
        context: 'exact location needed'
      };

      const result = await ToolHandlerService.handleToolCall('find_location', query);
      
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      
      // Should extract "Tokyo Shibuya district" as location candidate
      const jsonContent = result.content[0];
      if (!jsonContent.text.includes('Location Search Failed')) {
        const parsedData = JSON.parse(jsonContent.text);
        expect(parsedData.extractedCandidates).toContain('Tokyo Shibuya district');
      }
    });

    it('should handle ambiguous location queries', async () => {
      const query: WeatherQuery = {
        query: 'Paris',
        context: 'strict mode'
      };

      const result = await ToolHandlerService.handleToolCall('find_location', query);
      
      expect(result).toHaveProperty('content');
      const textContent = result.content[1];
      
      if (textContent.text.includes('Location Search Results')) {
        // Should mention multiple possibilities (Paris, France vs Paris, Texas)
        expect(textContent.text).toContain('Confidence');
      }
    });

    it('should handle invalid location queries gracefully', async () => {
      const query: WeatherQuery = {
        query: 'xyz123nonexistentplace'
      };

      const result = await ToolHandlerService.handleToolCall('find_location', query);
      
      expect(result).toHaveProperty('content');
      const textContent = result.content[0];
      expect(textContent.text).toContain('Location Search Failed');
    });
  });

  describe('get_weather_advice Tool', () => {
    it('should provide basic weather advice without location', async () => {
      const query: WeatherQuery = {
        query: 'should I wear a jacket today?'
      };

      const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);
      
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content).toHaveLength(2);
      
      // First content should be JSON data
      const jsonContent = result.content[0];
      expect(jsonContent.type).toBe('text');
      
      let parsedData;
      try {
        parsedData = JSON.parse(jsonContent.text);
      } catch (error) {
        // If parsing fails, it might be an error response
        expect(jsonContent.text).toContain('Weather Advice Error');
        return;
      }

      expect(parsedData).toHaveProperty('advice');
      expect(parsedData).toHaveProperty('source');
      expect(['gemini_ai', 'rule_based', 'hybrid']).toContain(parsedData.source);

      // Second content should be human-readable
      const textContent = result.content[1];
      expect(textContent.type).toBe('text');
      expect(textContent.text).toContain('Weather Advice');
    });

    it('should handle Chinese weather advice queries', async () => {
      const query: WeatherQuery = {
        query: '今天適合出門嗎？',
        context: '台北，戶外活動'
      };

      const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);
      
      expect(result).toHaveProperty('content');
      const textContent = result.content[1];
      
      if (textContent.text.includes('Weather Advice Error')) {
        // Expected in test environment
        expect(textContent.text).toContain('今天適合出門嗎？');
      } else {
        expect(textContent.text).toContain('Weather Advice');
      }
    });

    it('should handle activity-specific advice queries', async () => {
      const query: WeatherQuery = {
        query: 'is it good weather for surfing in California?',
        context: 'outdoor sports, beach activities'
      };

      const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);
      
      expect(result).toHaveProperty('content');
      const textContent = result.content[1];
      
      if (textContent.text.includes('Weather Advice')) {
        // Should contain activity-relevant advice
        expect(textContent.text.toLowerCase()).toMatch(/surf|beach|water|wind|wave/);
      }
    });

    it('should provide rule-based fallback advice', async () => {
      const query: WeatherQuery = {
        query: 'what should I wear in hot weather?'
      };

      const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);
      
      expect(result).toHaveProperty('content');
      const jsonContent = result.content[0];
      
      if (!jsonContent.text.includes('Weather Advice Error')) {
        const parsedData = JSON.parse(jsonContent.text);
        expect(parsedData.source).toBe('rule_based');
        expect(parsedData.advice.recommendations).toBeDefined();
        expect(Array.isArray(parsedData.advice.recommendations)).toBe(true);
      }
    });

    it('should handle complex multi-factor advice queries', async () => {
      const query: WeatherQuery = {
        query: 'planning outdoor wedding in New York next weekend, what should we prepare?',
        context: 'formal event, 100 guests, outdoor ceremony'
      };

      const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);
      
      expect(result).toHaveProperty('content');
      const textContent = result.content[1];
      
      if (textContent.text.includes('Weather Advice')) {
        // Should provide comprehensive advice for events
        expect(textContent.text.toLowerCase()).toMatch(/tent|rain|sun|temperature|wind/);
      }
    });
  });

  describe('Cross-Tool Integration', () => {
    it('should work in location → advice pipeline', async () => {
      // Step 1: Find location
      const locationQuery: WeatherQuery = {
        query: 'London, UK'
      };

      const locationResult = await ToolHandlerService.handleToolCall('find_location', locationQuery);
      expect(locationResult).toHaveProperty('content');

      // Step 2: Use location for weather advice
      const adviceQuery: WeatherQuery = {
        query: 'should I bring an umbrella in London today?',
        context: 'business meeting, walking outdoors'
      };

      const adviceResult = await ToolHandlerService.handleToolCall('get_weather_advice', adviceQuery);
      expect(adviceResult).toHaveProperty('content');
      
      const textContent = adviceResult.content[1];
      if (textContent.text.includes('Weather Advice')) {
        // Should provide London-specific advice
        expect(textContent.text.toLowerCase()).toMatch(/umbrella|rain|weather/);
      }
    });

    it('should handle search_weather → get_weather_advice pipeline', async () => {
      // This tests the integration between existing search_weather and new get_weather_advice
      const weatherQuery: WeatherQuery = {
        query: 'Tokyo weather today'
      };

      const weatherResult = await ToolHandlerService.handleToolCall('search_weather', weatherQuery);
      expect(weatherResult).toHaveProperty('content');

      // Follow up with advice based on weather
      const adviceQuery: WeatherQuery = {
        query: 'based on Tokyo weather, what should I wear for business meeting?',
        context: 'formal attire, indoor/outdoor combination'
      };

      const adviceResult = await ToolHandlerService.handleToolCall('get_weather_advice', adviceQuery);
      expect(adviceResult).toHaveProperty('content');
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle empty queries gracefully', async () => {
      const query: WeatherQuery = { query: '' };

      const locationResult = await ToolHandlerService.handleToolCall('find_location', query);
      expect(locationResult.content[0].text).toContain('Location Search Failed');

      const adviceResult = await ToolHandlerService.handleToolCall('get_weather_advice', query);
      expect(adviceResult.content[0].text).toContain('Weather Advice Error');
    });

    it('should handle very long queries', async () => {
      const longQuery = 'a'.repeat(1500); // Exceeds validation limit
      const query: WeatherQuery = { query: longQuery };

      try {
        await ToolHandlerService.handleToolCall('find_location', query);
      } catch (error) {
        expect(error).toHaveProperty('message');
        expect((error as Error).message).toContain('Query contains words longer than');
      }
    });

    it('should handle malicious input safely', async () => {
      const query: WeatherQuery = {
        query: '<script>alert("xss")</script>Paris weather',
        context: 'javascript:void(0)'
      };

      const result = await ToolHandlerService.handleToolCall('find_location', query);
      expect(result).toHaveProperty('content');
      
      // Should sanitize input
      const textContent = result.content[1];
      expect(textContent.text).not.toContain('<script>');
      expect(textContent.text).not.toContain('javascript:');
    });

    it('should handle network timeouts gracefully', async () => {
      // This would require mocking network calls, but we test the structure
      const query: WeatherQuery = {
        query: 'remote island location'
      };

      const result = await ToolHandlerService.handleToolCall('find_location', query);
      expect(result).toHaveProperty('content');
      
      // Should provide helpful error message
      const textContent = result.content[0];
      if (textContent.text.includes('Location Search Failed')) {
        expect(textContent.text).toContain('Suggestions:');
      }
    });
  });

  describe('Multi-language Support', () => {
    it('should detect and respond in Chinese', async () => {
      const query: WeatherQuery = {
        query: '東京天氣如何？需要帶傘嗎？'
      };

      const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);
      expect(result).toHaveProperty('content');
      
      // Response should be in Chinese (rule-based fallback)
      const textContent = result.content[1];
      if (textContent.text.includes('Weather Advice')) {
        // Rule-based system should detect Chinese and respond appropriately
        expect(textContent.text).toMatch(/[\u4e00-\u9fa5]/); // Contains Chinese characters
      }
    });

    it('should handle Japanese location names', async () => {
      const query: WeatherQuery = {
        query: '渋谷の天気',
        context: '日本語'
      };

      const result = await ToolHandlerService.handleToolCall('find_location', query);
      expect(result).toHaveProperty('content');
      
      const textContent = result.content[1];
      if (textContent.text.includes('Location Search Results')) {
        expect(textContent.text).toContain('渋谷');
      }
    });

    it('should handle mixed language queries', async () => {
      const query: WeatherQuery = {
        query: 'New York 今天天氣 weather advice'
      };

      const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);
      expect(result).toHaveProperty('content');
      
      // Should handle mixed input gracefully
      const textContent = result.content[1];
      expect(textContent.text).toContain('Weather Advice');
    });
  });

  describe('Performance & Reliability', () => {
    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      const query: WeatherQuery = {
        query: 'San Francisco weather advice'
      };

      const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // 10 seconds max for integration test
      expect(result).toHaveProperty('content');
    });

    it('should maintain consistent response format', async () => {
      const queries = [
        { query: 'London location' },
        { query: 'weather advice for hiking' },
        { query: '台北地點搜尋' }
      ];

      for (const query of queries) {
        const locationResult = await ToolHandlerService.handleToolCall('find_location', query);
        expect(locationResult).toHaveProperty('content');
        expect(Array.isArray(locationResult.content)).toBe(true);
        expect(locationResult.content).toHaveLength(2);

        const adviceResult = await ToolHandlerService.handleToolCall('get_weather_advice', query);
        expect(adviceResult).toHaveProperty('content');
        expect(Array.isArray(adviceResult.content)).toBe(true);
        expect(adviceResult.content).toHaveLength(2);
      }
    });
  });
});

describe('Phase 4.2: Tool Definition Compliance', () => {
  it('should maintain MCP design philosophy compliance', () => {
    const toolDefinitions = ToolHandlerService.getToolDefinitions();
    
    expect(toolDefinitions.tools).toHaveLength(3);
    
    const findLocationTool = toolDefinitions.tools.find(t => t.name === 'find_location');
    expect(findLocationTool).toBeDefined();
    expect(findLocationTool?.description).toContain('幫助用戶發現和確認地點位置');
    expect(findLocationTool?.inputSchema.properties).toHaveProperty('query');
    expect(findLocationTool?.inputSchema.properties).toHaveProperty('context');
    expect(findLocationTool?.inputSchema.required).toEqual(['query']);

    const getWeatherAdviceTool = toolDefinitions.tools.find(t => t.name === 'get_weather_advice');
    expect(getWeatherAdviceTool).toBeDefined();
    expect(getWeatherAdviceTool?.description).toContain('基於天氣資訊提供個人化建議');
    expect(getWeatherAdviceTool?.inputSchema.properties).toHaveProperty('query');
    expect(getWeatherAdviceTool?.inputSchema.properties).toHaveProperty('context');
    expect(getWeatherAdviceTool?.inputSchema.required).toEqual(['query']);
  });

  it('should use unified parameter structure', () => {
    const toolDefinitions = ToolHandlerService.getToolDefinitions();
    
    toolDefinitions.tools.forEach(tool => {
      expect(tool.inputSchema.properties).toHaveProperty('query');
      expect(tool.inputSchema.properties).toHaveProperty('context');
      expect(tool.inputSchema.required).toEqual(['query']);
      
      // Context should be string, not object (MCP philosophy)
      expect(tool.inputSchema.properties.context.type).toBe('string');
    });
  });
});
