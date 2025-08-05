import { ToolHandlerService } from '../../../src/services/tool-handlers';
import { WeatherQuery } from '../../../src/types/index';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

describe('ToolHandlerService', () => {
  describe('getToolDefinitions', () => {
    it('should return all three tool definitions', () => {
      const definitions = ToolHandlerService.getToolDefinitions();
      
      expect(definitions.tools).toHaveLength(3);
      
      const toolNames = definitions.tools.map(tool => tool.name);
      expect(toolNames).toEqual(['search_weather', 'find_location', 'get_weather_advice']);
    });

    it('should have proper schema structure for all tools', () => {
      const definitions = ToolHandlerService.getToolDefinitions();
      
      definitions.tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(tool.inputSchema).toHaveProperty('required');
        expect(tool.inputSchema.required).toContain('query');
      });
    });

    it('should have detailed descriptions for weather search tool', () => {
      const definitions = ToolHandlerService.getToolDefinitions();
      const weatherTool = definitions.tools.find(tool => tool.name === 'search_weather');
      
      expect(weatherTool?.description).toContain('natural language');
      expect(weatherTool?.inputSchema.properties.query).toBeDefined();
      expect(weatherTool?.inputSchema.properties.context).toBeDefined();
    });
  });

  describe('handleToolCall', () => {
    it('should handle search_weather with full context', async () => {
      const query: WeatherQuery = {
        query: 'What is the weather like in Tokyo today?',
        context: 'location: Tokyo, timeframe: today, preferences: units metric'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Weather search placeholder');
      expect(result.content[0].text).toContain('Tokyo today');
      expect(result.content[0].text).toContain('Context:');
    });

    it('should handle find_location with country context', async () => {
      const query: WeatherQuery = {
        query: 'Paris',
        context: 'country: France, region: Île-de-France'
      };

      const result = await ToolHandlerService.handleToolCall('find_location', query);

      expect(result.content[0].text).toContain('Location search placeholder');
      expect(result.content[0].text).toContain('Paris');
      expect(result.content[0].text).toContain('France');
    });

    it('should handle get_weather_advice with activity context', async () => {
      const query: WeatherQuery = {
        query: 'Should I bring an umbrella for my outdoor wedding?',
        context: 'location: Central Park, NYC, activity: outdoor wedding, preferences: conservative true'
      };

      const result = await ToolHandlerService.handleToolCall('get_weather_advice', query);

      expect(result.content[0].text).toContain('Weather advice placeholder');
      expect(result.content[0].text).toContain('umbrella');
      expect(result.content[0].text).toContain('outdoor wedding');
    });

    it('should handle queries without context', async () => {
      const query: WeatherQuery = {
        query: 'Current weather'
      };

      const result = await ToolHandlerService.handleToolCall('search_weather', query);

      expect(result.content[0].text).toContain('Current weather');
      expect(result.content[0].text).not.toContain('Context:');
    });

    it('should throw McpError for unknown tools', async () => {
      const query: WeatherQuery = { query: 'test' };

      await expect(ToolHandlerService.handleToolCall('unknown_tool', query))
        .rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should handle malformed query arguments gracefully', async () => {
      const malformedQuery = { not_a_query: 'test' };

      // Should throw validation error for missing query parameter
      await expect(ToolHandlerService.handleToolCall('search_weather', malformedQuery))
        .rejects.toThrow('Query parameter is required and must be a string');
    });
  });

  describe('setupServerHandlers', () => {
    let mockServer: jest.Mocked<Server>;

    beforeEach(() => {
      mockServer = {
        setRequestHandler: jest.fn()
      } as any;
    });

    it('should set up both list and call tool handlers', () => {
      ToolHandlerService.setupServerHandlers(mockServer);

      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
      
      // Verify the handlers were set up for the correct request types
      const calls = mockServer.setRequestHandler.mock.calls;
      expect(calls[0][0]).toBeDefined(); // ListToolsRequestSchema
      expect(calls[1][0]).toBeDefined(); // CallToolRequestSchema
    });

    it('should set up handlers that can be called', async () => {
      let listToolsHandler: Function | undefined;
      let callToolHandler: Function | undefined;

      mockServer.setRequestHandler.mockImplementation((schema, handler) => {
        if (schema === ListToolsRequestSchema) {
          listToolsHandler = handler;
        } else if (schema === CallToolRequestSchema) {
          callToolHandler = handler;
        }
      });

      ToolHandlerService.setupServerHandlers(mockServer);

      // Test list tools handler
      expect(listToolsHandler).toBeDefined();
      const toolList = await listToolsHandler!();
      expect(toolList.tools).toHaveLength(3);

      // Test call tool handler
      const mockRequest = {
        params: {
          name: 'search_weather',
          arguments: { query: 'test weather' }
        }
      };

      expect(callToolHandler).toBeDefined();
      const toolResult = await callToolHandler!(mockRequest);
      expect(toolResult.content).toHaveLength(1);
      expect(toolResult.content[0].text).toContain('Weather search placeholder');
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety with WeatherQuery interface', async () => {
      const query: WeatherQuery = {
        query: 'test',
        context: 'location: test, timeframe: test, country: test, region: test, activity: test, preferences: test value, customField: allowed'
      };

      // Should compile and run without type errors
      const result = await ToolHandlerService.handleToolCall('search_weather', query);
      expect(result.content[0].type).toBe('text');
    });

    it('should return properly typed MCPToolResponse', async () => {
      const query: WeatherQuery = { query: 'test' };
      const result = await ToolHandlerService.handleToolCall('search_weather', query);

      // TypeScript should enforce this structure
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(typeof result.content[0].text).toBe('string');
    });
  });
});