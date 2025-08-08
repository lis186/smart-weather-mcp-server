import { ToolHandlerService } from '../../src/services/tool-handlers';
import { WeatherQuery } from '../../src/types/index';

describe('AI Degradation - GEMINI_DISABLED', () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.GEMINI_DISABLED = 'true';
    // Ensure weather service doesn't try real API in tests
    process.env.WEATHER_API_KEY = '';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should fallback to rule-based mode when GEMINI_DISABLED is true', async () => {
    const query: WeatherQuery = {
      query: 'What is the weather in Tokyo?',
      context: 'location: Tokyo'
    };

    const result = await ToolHandlerService.handleToolCall('search_weather', query);

    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    const text = (result.content[0] as any).text as string;
    expect(text).toContain('search_weather');
    // Fallback path should indicate fallback/初始化問題（英文字樣即可）
    expect(text).toMatch(/Fallback Mode|not initialized|fallback/i);
  });
});


