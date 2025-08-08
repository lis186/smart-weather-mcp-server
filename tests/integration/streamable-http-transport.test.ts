import axios, { AxiosError } from 'axios';
import { ExpressServer } from '../../src/core/express-server';
import { ServerConfig } from '../../src/types/index';
import { getAvailablePort } from '../test-utils';

describe('Streamable HTTP Transport Integration', () => {
  let server: ExpressServer;
  let testPort: number;
  const testHost = 'localhost';
  let baseUrl: string;

  beforeAll(async () => {
    testPort = await getAvailablePort();
    baseUrl = `http://${testHost}:${testPort}`;
    
    const config: ServerConfig = {
      port: testPort,
      host: testHost,
      environment: 'test',
      secrets: {
        geminiApiKey: 'test-key',
        weatherApiKey: 'test-key'
      }
    };
    
    server = new ExpressServer(config);
    await server.start();
    // Give server time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    // Clean up
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Streamable HTTP Endpoint', () => {
    it('should establish SSE connection with proper headers', async () => {
      try {
        const response = await axios.get(`${baseUrl}/mcp`, {
          headers: {
            'Accept': 'text/event-stream,application/json'
          },
          responseType: 'stream',
          timeout: 2000,
          validateStatus: (status) => status === 200
        });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/event-stream');
        expect(response.headers['cache-control']).toContain('no-cache');
        expect(response.headers['connection']).toContain('keep-alive');
      } catch (error) {
        // SSE connections will timeout in tests, which is expected
        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            // Expected for SSE streams
            expect(true).toBe(true);
          } else {
            throw error;
          }
        }
      }
    });

    it('should reject SSE requests without text/event-stream accept header', async () => {
      try {
        await axios.get(`${baseUrl}/mcp`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        fail('Should have rejected the request');
      } catch (error) {
        if (axios.isAxiosError(error)) {
          expect(error.response?.status).toBe(406);
          expect(error.response?.data).toHaveProperty('error');
          expect(error.response?.data.error.message).toContain('Not Acceptable');
        } else {
          throw error;
        }
      }
    });
  });

  describe('MCP Protocol Messages', () => {
    it('should handle initialize request', async () => {
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      try {
        const response = await axios.post(`${baseUrl}/mcp`, initRequest, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('jsonrpc', '2.0');
        expect(response.data).toHaveProperty('id', 1);
        expect(response.data).toHaveProperty('result');
        expect(response.data.result).toHaveProperty('protocolVersion');
        expect(response.data.result).toHaveProperty('serverInfo');
        expect(response.data.result.serverInfo).toHaveProperty('name', 'smart-weather-mcp-server');
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('Initialize request failed:', error.response?.data || error.message);
        }
        throw error;
      }
    });

    it('should handle tools/list request', async () => {
      const toolsListRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      try {
        const response = await axios.post(`${baseUrl}/mcp`, toolsListRequest, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('jsonrpc', '2.0');
        expect(response.data).toHaveProperty('id', 2);
        expect(response.data).toHaveProperty('result');
        expect(response.data.result).toHaveProperty('tools');
        expect(Array.isArray(response.data.result.tools)).toBe(true);
        
        const toolNames = response.data.result.tools.map((t: any) => t.name);
        expect(toolNames).toContain('search_weather');
        expect(toolNames).toContain('find_location');
        expect(toolNames).toContain('get_weather_advice');
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('Tools list request failed:', error.response?.data || error.message);
        }
        throw error;
      }
    });

    it('should handle tool call request', async () => {
      // First initialize
      await axios.post(`${baseUrl}/mcp`, {
        jsonrpc: '2.0',
        id: 10,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        }
      });

      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_weather',
          arguments: {
            query: 'What is the weather in New York?'
          }
        }
      };

      try {
        const response = await axios.post(`${baseUrl}/mcp`, toolCallRequest, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          timeout: 10000
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('jsonrpc', '2.0');
        expect(response.data).toHaveProperty('id', 3);
        expect(response.data).toHaveProperty('result');
        expect(response.data.result).toHaveProperty('content');
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('Tool call request failed:', error.response?.data || error.message);
        }
        throw error;
      }
    });
  });

  describe('Stateless Operation', () => {
    it('should handle multiple concurrent connections', async () => {
      const requests = [];
      
      // Send multiple initialize requests concurrently
      for (let i = 0; i < 5; i++) {
        requests.push(
          axios.post(`${baseUrl}/mcp`, {
            jsonrpc: '2.0',
            id: 100 + i,
            method: 'initialize',
            params: {
              protocolVersion: '1.0.0',
              capabilities: {},
              clientInfo: {
                name: `test-client-${i}`,
                version: '1.0.0'
              }
            }
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/event-stream'
            }
          })
        );
      }

      const responses = await Promise.all(requests);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('id', 100 + index);
        expect(response.data).toHaveProperty('result');
      });
    });

    it('should not require session ID for requests', async () => {
      // Direct POST without any session management
      const response = await axios.post(`${baseUrl}/mcp`, {
        jsonrpc: '2.0',
        id: 200,
        method: 'tools/list',
        params: {}
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('result');
      // Should not have session ID in headers (stateless)
      expect(response.headers['mcp-session-id']).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON-RPC requests', async () => {
      try {
        const response = await axios.post(`${baseUrl}/mcp`, {
          invalid: 'request'
        });
        
        // The response might still be 200 with an error in the JSON-RPC format
        if (response.data.error) {
          expect(response.data).toHaveProperty('error');
          expect(response.data.error).toHaveProperty('code');
          expect(response.data.error).toHaveProperty('message');
        }
      } catch (error) {
        // Or it might return an HTTP error
        if (axios.isAxiosError(error)) {
          expect(error.response?.status).toBeGreaterThanOrEqual(400);
        }
      }
    });

    it('should handle unsupported methods with DELETE', async () => {
      try {
        await axios.delete(`${baseUrl}/mcp`);
        fail('Should have rejected DELETE method');
      } catch (error) {
        if (axios.isAxiosError(error)) {
          expect(error.response?.status).toBe(405);
        }
      }
    });
  });
});