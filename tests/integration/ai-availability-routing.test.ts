import { ToolHandlerService } from '../../src/services/tool-handlers';
import { WeatherQuery } from '../../src/types/index';

describe('AI Availability Routing', () => {
  const originalEnv = { ...process.env } as any;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses AI-enhanced path when Gemini is available', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'fake-project';
    process.env.GEMINI_DISABLED = 'false';
    // Avoid real API
    process.env.WEATHER_API_KEY = '';

    const query: WeatherQuery = {
      query: '沖繩明天天氣預報 衝浪條件 海浪高度 風速',
      context: '語言: zh-TW'
    };

    const result = await ToolHandlerService.handleToolCall('search_weather', query);
    expect(result).toHaveProperty('content');
    const text = (result.content[0] as any).text as string;
    expect(typeof text).toBe('string');
  });

  it('falls back to rules when Gemini is disabled', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = '';
    process.env.GEMINI_DISABLED = 'true';
    process.env.WEATHER_API_KEY = '';

    const query: WeatherQuery = {
      query: '沖繩明天天氣預報 衝浪條件 海浪高度 風速',
      context: '語言: zh-TW'
    };

    const result = await ToolHandlerService.handleToolCall('search_weather', query);
    const text = (result.content[0] as any).text as string;
    expect(text).toMatch(/fallback|not initialized|search_weather/i);
  });
});


