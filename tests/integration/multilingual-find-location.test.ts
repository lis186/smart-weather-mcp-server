import { ToolHandlerService } from '../../src/services/tool-handlers';
import { WeatherQuery } from '../../src/types/index';

describe('Multilingual - find_location (zh-TW)', () => {
  beforeAll(() => {
    // Avoid real external calls by not providing keys
    process.env.WEATHER_API_KEY = '';
    process.env.GOOGLE_CLOUD_PROJECT = '';
  });

  it('should handle Traditional Chinese query gracefully', async () => {
    const query: WeatherQuery = {
      query: '台北101 在哪裡',
      context: '語言: zh-TW'
    };

    const result = await ToolHandlerService.handleToolCall('find_location', query);
    expect(result).toHaveProperty('content');
    const text = (result.content[0] as any).text as string;
    expect(typeof text).toBe('string');
    expect(text).toContain('find_location');
    expect(text).toContain('台北');
  });
});

describe('Multilingual - find_location (en & ja)', () => {
  beforeAll(() => {
    process.env.WEATHER_API_KEY = '';
    process.env.GOOGLE_CLOUD_PROJECT = '';
  });

  it('should handle English query gracefully', async () => {
    const query: WeatherQuery = {
      query: 'Where is Times Square?',
      context: 'language: en'
    };

    const result = await ToolHandlerService.handleToolCall('find_location', query);
    expect(result).toHaveProperty('content');
    const text = (result.content[0] as any).text as string;
    expect(typeof text).toBe('string');
    expect(text.toLowerCase()).toContain('find_location');
  });

  it('should handle Japanese query gracefully', async () => {
    const query: WeatherQuery = {
      query: '渋谷スクランブル交差点 どこ',
      context: '言語: ja'
    };

    const result = await ToolHandlerService.handleToolCall('find_location', query);
    expect(result).toHaveProperty('content');
    const text = (result.content[0] as any).text as string;
    expect(typeof text).toBe('string');
    expect(text).toContain('find_location');
  });
});


