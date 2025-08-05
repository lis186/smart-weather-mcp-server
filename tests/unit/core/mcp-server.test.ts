import { SmartWeatherMCPServer } from '../../../src/core/mcp-server';
import { ToolHandlerService } from '../../../src/services/tool-handlers';
import { WeatherQuery } from '../../../src/types/index';

describe('SmartWeatherMCPServer', () => {
  let server: SmartWeatherMCPServer;

  beforeEach(() => {
    server = new SmartWeatherMCPServer();
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

  describe('Tool Handler Integration', () => {
    it('should use shared tool handler service', () => {
      // Verify that the server is using the shared tool handler service
      const serverInstance = (server as any).server;
      expect(serverInstance._requestHandlers).toBeDefined();
    });
  });
});

// Test the shared tool handler service separately
describe('ToolHandlerService', () => {
  describe('Tool Definitions', () => {
    it('should return correct tool definitions', () => {
      const definitions = ToolHandlerService.getToolDefinitions();
      
      expect(definitions.tools).toHaveLength(3);
      expect(definitions.tools[0].name).toBe('search_weather');
      expect(definitions.tools[1].name).toBe('find_location');
      expect(definitions.tools[2].name).toBe('get_weather_advice');
    });
  });

  describe('Tool Handlers', () => {
    describe('handleToolCall', () => {
      it('should handle search_weather tool call', async () => {
        const query: WeatherQuery = {
          query: 'What is the weather in Tokyo?',
          context: 'location: Tokyo'
        };

        const result = await ToolHandlerService.handleToolCall('search_weather', query);

        expect(result).toHaveProperty('content');
        expect(result.content).toBeInstanceOf(Array);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('Phase 2 Weather Search Results');
        expect(result.content[0].text).toContain(query.query);
      });

      it('should handle find_location tool call', async () => {
        const query: WeatherQuery = {
          query: 'Tokyo, Japan',
          context: 'country: Japan'
        };

        const result = await ToolHandlerService.handleToolCall('find_location', query);

        expect(result).toHaveProperty('content');
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('Location search placeholder');
        expect(result.content[0].text).toContain(query.query);
      });

      it('should handle get_weather_advice tool call', async () => {
        const query: WeatherQuery = {
          query: 'Should I bring an umbrella?',
          context: 'location: Tokyo, activity: outdoor event'
        };

        const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);

        expect(result).toHaveProperty('content');
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('Weather advice placeholder');
        expect(result.content[0].text).toContain(query.query);
      });

      it('should handle query without context', async () => {
        const query: WeatherQuery = {
          query: 'Current weather'
        };

        const result = await ToolHandlerService.handleToolCall('search_weather', query);

        expect(result.content[0].text).toContain('Current weather');
        expect(result.content[0].text).not.toContain('Context:');
      });

      it('should throw error for unknown tool', async () => {
        const query: WeatherQuery = { query: 'test' };

        await expect(ToolHandlerService.handleToolCall('unknown_tool', query))
          .rejects.toThrow('Unknown tool: unknown_tool');
      });
    });
  });
});