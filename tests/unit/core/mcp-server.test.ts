import { SmartWeatherMCPServer } from '../../../src/core/mcp-server.js';
import { WeatherQuery } from '../../../src/types/index.js';

describe('SmartWeatherMCPServer', () => {
  let server: SmartWeatherMCPServer;

  beforeEach(() => {
    server = new SmartWeatherMCPServer();
  });

  describe('Tool Handlers', () => {
    describe('handleSearchWeather', () => {
      it('should return placeholder response for weather search', async () => {
        const query: WeatherQuery = {
          query: 'What is the weather in Tokyo?',
          context: { location: 'Tokyo' }
        };

        // Access private method for testing
        const result = await (server as any).handleSearchWeather(query);

        expect(result).toHaveProperty('content');
        expect(result.content).toBeInstanceOf(Array);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('Weather search placeholder');
        expect(result.content[0].text).toContain(query.query);
      });

      it('should handle query without context', async () => {
        const query: WeatherQuery = {
          query: 'Current weather'
        };

        const result = await (server as any).handleSearchWeather(query);

        expect(result.content[0].text).toContain('Current weather');
        expect(result.content[0].text).not.toContain('Context:');
      });
    });

    describe('handleFindLocation', () => {
      it('should return placeholder response for location search', async () => {
        const query: WeatherQuery = {
          query: 'Tokyo, Japan',
          context: { country: 'Japan' }
        };

        const result = await (server as any).handleFindLocation(query);

        expect(result).toHaveProperty('content');
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('Location search placeholder');
        expect(result.content[0].text).toContain(query.query);
      });
    });

    describe('handleGetWeatherAdvice', () => {
      it('should return placeholder response for weather advice', async () => {
        const query: WeatherQuery = {
          query: 'Should I bring an umbrella?',
          context: { 
            location: 'Tokyo',
            activity: 'outdoor event'
          }
        };

        const result = await (server as any).handleGetWeatherAdvice(query);

        expect(result).toHaveProperty('content');
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('Weather advice placeholder');
        expect(result.content[0].text).toContain(query.query);
      });
    });
  });

  describe('Server Configuration', () => {
    it('should have correct server metadata', () => {
      const serverInstance = (server as any).server;
      
      expect(serverInstance.serverInfo.name).toBe('smart-weather-mcp-server');
      expect(serverInstance.serverInfo.version).toBe('1.0.0');
    });

    it('should have tools capability enabled', () => {
      const serverInstance = (server as any).server;
      
      expect(serverInstance.capabilities).toHaveProperty('tools');
    });
  });
});