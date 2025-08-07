/**
 * Unit tests for Gemini Weather Parser
 * Smart Weather MCP Server - Phase 2.1 Implementation
 */

import { GeminiWeatherParser } from '../../../src/services/gemini-parser.js';
import { GeminiClient } from '../../../src/services/gemini-client.js';
import { QueryParsingRequest, ParsingResult } from '../../../src/types/parser.js';

// Mock the Gemini client
jest.mock('../../../src/services/gemini-client.js');

describe('GeminiWeatherParser', () => {
  let parser: GeminiWeatherParser;
  let mockGeminiClient: jest.Mocked<GeminiClient>;

  beforeEach(() => {
    // Create mock Gemini client
    mockGeminiClient = {
      generateContent: jest.fn(),
      parseStructuredResponse: jest.fn(),
      getConfig: jest.fn().mockReturnValue({ 
        model: 'gemini-2.5-flash-002',
        projectId: 'test-project',
        temperature: 0.1 
      }),
      getUsageStats: jest.fn(),
      resetUsageStats: jest.fn(),
      updateConfig: jest.fn(),
      healthCheck: jest.fn()
    } as any;

    parser = new GeminiWeatherParser(mockGeminiClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Query Parsing', () => {
    it('should parse simple current weather query', async () => {
      const mockGeminiResponse = {
        location: {
          name: 'Tokyo',
          coordinates: { lat: 35.6762, lng: 139.6503 },
          confidence: 0.9
        },
        intent: {
          primary: 'CURRENT_WEATHER',
          confidence: 0.95
        },
        timeScope: {
          type: 'current',
          period: 'today',
          confidence: 0.9
        },
        weatherMetrics: ['temperature', 'conditions'],
        userPreferences: {
          language: 'en',
          temperatureUnit: 'celsius',
          detailLevel: 'basic'
        },
        confidence: 0.9
      };

      mockGeminiClient.generateContent.mockResolvedValue({
        response: JSON.stringify(mockGeminiResponse),
        tokensUsed: 150
      });

      mockGeminiClient.parseStructuredResponse.mockReturnValue(mockGeminiResponse);

      const request: QueryParsingRequest = {
        query: 'What is the weather like in Tokyo today?'
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(true);
      expect(result.result?.location.name).toBe('Tokyo');
      expect(result.result?.intent.primary).toBe('CURRENT_WEATHER');
      expect(result.result?.confidence).toBe(0.9);
      expect(result.metadata.tokensUsed).toBe(150);
    });

    it('should parse Chinese weather query', async () => {
      const mockGeminiResponse = {
        location: {
          name: '北京',
          confidence: 0.85
        },
        intent: {
          primary: 'WEATHER_FORECAST',
          confidence: 0.9
        },
        timeScope: {
          type: 'forecast',
          period: 'tomorrow',
          confidence: 0.85
        },
        weatherMetrics: ['temperature', 'conditions'],
        userPreferences: {
          language: 'zh-CN',
          temperatureUnit: 'celsius',
          detailLevel: 'basic'
        },
        confidence: 0.85
      };

      mockGeminiClient.generateContent.mockResolvedValue({
        response: JSON.stringify(mockGeminiResponse),
        tokensUsed: 120
      });

      mockGeminiClient.parseStructuredResponse.mockReturnValue(mockGeminiResponse);

      const request: QueryParsingRequest = {
        query: '明天北京的天氣如何？'
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(true);
      expect(result.result?.location.name).toBe('北京');
      expect(result.result?.intent.primary).toBe('WEATHER_FORECAST');
      expect(result.result?.userPreferences.language).toBe('zh-CN');
    });

    it('should parse Japanese weather query', async () => {
      const mockGeminiResponse = {
        location: {
          name: '東京',
          confidence: 0.9
        },
        intent: {
          primary: 'CURRENT_WEATHER',
          confidence: 0.9
        },
        timeScope: {
          type: 'current',
          period: 'today',
          confidence: 0.9
        },
        weatherMetrics: ['temperature', 'conditions'],
        userPreferences: {
          language: 'ja',
          temperatureUnit: 'celsius',
          detailLevel: 'basic'
        },
        confidence: 0.9
      };

      mockGeminiClient.generateContent.mockResolvedValue({
        response: JSON.stringify(mockGeminiResponse),
        tokensUsed: 140
      });

      mockGeminiClient.parseStructuredResponse.mockReturnValue(mockGeminiResponse);

      const request: QueryParsingRequest = {
        query: '今日の東京の天気はどうですか？'
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(true);
      expect(result.result?.location.name).toBe('東京');
      expect(result.result?.userPreferences.language).toBe('ja');
    });
  });

  describe('Intent Classification', () => {
    it('should classify weather advice intent', async () => {
      const mockGeminiResponse = {
        location: {
          name: undefined,
          confidence: 0.3
        },
        intent: {
          primary: 'WEATHER_ADVICE',
          confidence: 0.8
        },
        timeScope: {
          type: 'current',
          period: 'today',
          confidence: 0.7
        },
        weatherMetrics: ['precipitation'],
        userPreferences: {
          language: 'en',
          temperatureUnit: 'celsius',
          detailLevel: 'basic'
        },
        confidence: 0.75
      };

      mockGeminiClient.generateContent.mockResolvedValue({
        response: JSON.stringify(mockGeminiResponse),
        tokensUsed: 100
      });

      mockGeminiClient.parseStructuredResponse.mockReturnValue(mockGeminiResponse);

      const request: QueryParsingRequest = {
        query: 'Should I bring an umbrella today?'
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(true);
      expect(result.result?.intent.primary).toBe('WEATHER_ADVICE');
      expect(result.result?.weatherMetrics).toContain('precipitation');
    });

    it('should classify location search intent', async () => {
      const mockGeminiResponse = {
        location: {
          name: undefined,
          confidence: 0.2
        },
        intent: {
          primary: 'LOCATION_SEARCH',
          confidence: 0.9
        },
        timeScope: {
          type: 'current',
          confidence: 0.5
        },
        weatherMetrics: ['conditions'],
        userPreferences: {
          language: 'en',
          temperatureUnit: 'celsius',
          detailLevel: 'basic'
        },
        confidence: 0.7
      };

      mockGeminiClient.generateContent.mockResolvedValue({
        response: JSON.stringify(mockGeminiResponse),
        tokensUsed: 90
      });

      mockGeminiClient.parseStructuredResponse.mockReturnValue(mockGeminiResponse);

      const request: QueryParsingRequest = {
        query: 'Where is the nearest weather station?'
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(true);
      expect(result.result?.intent.primary).toBe('LOCATION_SEARCH');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty query', async () => {
      const request: QueryParsingRequest = {
        query: ''
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('PARSING_FAILED');
      expect(result.error?.message).toContain('Failed to parse weather query');
    });

    it('should handle overly long query', async () => {
      const request: QueryParsingRequest = {
        query: 'x'.repeat(1001)
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(false);
      expect(result.error?.details).toContain('too long');
    });

    it('should handle low confidence parsing', async () => {
      const mockGeminiResponse = {
        location: {
          name: 'Unknown',
          confidence: 0.1
        },
        intent: {
          primary: 'CURRENT_WEATHER',
          confidence: 0.1
        },
        timeScope: {
          type: 'current',
          confidence: 0.1
        },
        weatherMetrics: ['temperature'],
        userPreferences: {
          language: 'en',
          temperatureUnit: 'celsius',
          detailLevel: 'basic'
        },
        confidence: 0.1 // Below default threshold of 0.3
      };

      mockGeminiClient.generateContent.mockResolvedValue({
        response: JSON.stringify(mockGeminiResponse),
        tokensUsed: 50
      });

      mockGeminiClient.parseStructuredResponse.mockReturnValue(mockGeminiResponse);

      const request: QueryParsingRequest = {
        query: 'xyz abc random text'
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(false);
      expect(result.error?.details).toContain('confidence');
    });

    it('should handle Gemini API errors', async () => {
      mockGeminiClient.generateContent.mockRejectedValue(new Error('API timeout'));

      const request: QueryParsingRequest = {
        query: 'What is the weather like today?'
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('PARSING_FAILED');
      expect(result.error?.retryable).toBe(true);
    });

    it('should provide helpful error suggestions', async () => {
      const request: QueryParsingRequest = {
        query: 'weather' // Very short query
      };

      const result = await parser.parseQuery(request);

      expect(result.success).toBe(false);
      expect(result.error?.suggestions).toBeDefined();
      expect(result.error?.suggestions?.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Configuration', () => {
    it('should respect strict mode validation', async () => {
      const strictParser = new GeminiWeatherParser(mockGeminiClient, {
        strictMode: true,
        minConfidence: 0.8
      });

      const mockGeminiResponse = {
        location: {
          name: 'Tokyo',
          confidence: 0.7
        },
        intent: {
          primary: 'CURRENT_WEATHER',
          confidence: 0.6 // Below strict mode threshold
        },
        timeScope: {
          type: 'current',
          confidence: 0.6
        },
        weatherMetrics: ['temperature'],
        userPreferences: {
          language: 'en',
          temperatureUnit: 'celsius',
          detailLevel: 'basic'
        },
        confidence: 0.85
      };

      mockGeminiClient.generateContent.mockResolvedValue({
        response: JSON.stringify(mockGeminiResponse),
        tokensUsed: 100
      });

      mockGeminiClient.parseStructuredResponse.mockReturnValue(mockGeminiResponse);

      const request: QueryParsingRequest = {
        query: 'weather tokyo'
      };

      const result = await strictParser.parseQuery(request);

      expect(result.success).toBe(false);
      expect(result.error?.details).toContain('confidence too low for strict mode');
    });

    it('should require location when configured', async () => {
      const locationRequiredParser = new GeminiWeatherParser(mockGeminiClient, {
        requireLocation: true
      });

      const mockGeminiResponse = {
        location: {
          name: undefined,
          confidence: 0.2
        },
        intent: {
          primary: 'CURRENT_WEATHER',
          confidence: 0.8
        },
        timeScope: {
          type: 'current',
          confidence: 0.8
        },
        weatherMetrics: ['temperature'],
        userPreferences: {
          language: 'en',
          temperatureUnit: 'celsius',
          detailLevel: 'basic'
        },
        confidence: 0.7
      };

      mockGeminiClient.generateContent.mockResolvedValue({
        response: JSON.stringify(mockGeminiResponse),
        tokensUsed: 100
      });

      mockGeminiClient.parseStructuredResponse.mockReturnValue(mockGeminiResponse);

      const request: QueryParsingRequest = {
        query: 'What is the temperature?'
      };

      const result = await locationRequiredParser.parseQuery(request);

      expect(result.success).toBe(false);
      expect(result.error?.details).toContain('Location is required');
    });
  });

  describe('Configuration Management', () => {
    it('should update validation configuration', () => {
      const initialConfig = parser.getValidationConfig();
      expect(initialConfig.minConfidence).toBe(0.3);

      parser.updateValidation({ minConfidence: 0.5 });

      const updatedConfig = parser.getValidationConfig();
      expect(updatedConfig.minConfidence).toBe(0.5);
    });
  });

  describe('Parser Testing', () => {
    it('should run self-test with predefined queries', async () => {
      // Mock successful responses for all test queries
      const mockGeminiResponse = {
        location: { name: 'Test Location', confidence: 0.8 },
        intent: { primary: 'CURRENT_WEATHER', confidence: 0.8 },
        timeScope: { type: 'current', confidence: 0.8 },
        weatherMetrics: ['temperature'],
        userPreferences: { language: 'en', temperatureUnit: 'celsius', detailLevel: 'basic' },
        confidence: 0.8
      };

      mockGeminiClient.generateContent.mockResolvedValue({
        response: JSON.stringify(mockGeminiResponse),
        tokensUsed: 100
      });

      mockGeminiClient.parseStructuredResponse.mockReturnValue(mockGeminiResponse);

      const testResult = await parser.testParser();

      expect(testResult.passed).toBeGreaterThan(0);
      expect(testResult.results).toHaveLength(5); // 5 predefined test queries
      expect(testResult.passed + testResult.failed).toBe(5);
    });
  });
});