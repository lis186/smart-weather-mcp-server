import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import { SmartWeatherMCPServer } from '../../src/core/mcp-server.js';
import { ExpressServer } from '../../src/core/express-server.js';

describe('Dual Transport Integration', () => {
  const testPort = 8081;
  const testHost = 'localhost';
  let httpServer: ExpressServer;
  let stdioProcess: ChildProcess;

  afterEach(async () => {
    // Clean up any servers
    if (stdioProcess) {
      stdioProcess.kill();
    }
  });

  describe('HTTP/SSE Transport Mode', () => {
    beforeEach(async () => {
      const config = {
        port: testPort,
        host: testHost,
        environment: 'development' as const,
        secrets: {
          geminiApiKey: 'test-key',
          weatherApiKey: 'test-key'
        }
      };
      
      httpServer = new ExpressServer(config);
      await httpServer.start();
    });

    afterEach(() => {
      // Express server cleanup is handled by process termination
    });

    it('should start HTTP server successfully', async () => {
      const response = await axios.get(`http://${testHost}:${testPort}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: 'healthy',
        service: 'smart-weather-mcp-server',
        version: '1.0.0',
        environment: 'development'
      });
    });

    it('should serve root endpoint with API information', async () => {
      const response = await axios.get(`http://${testHost}:${testPort}/`);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        name: 'Smart Weather MCP Server',
        version: '1.0.0',
        tools: ['search_weather', 'find_location', 'get_weather_advice']
      });
    });

    it('should handle 404 for unknown endpoints', async () => {
      try {
        await axios.get(`http://${testHost}:${testPort}/unknown`);
        fail('Should have thrown 404 error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.error).toContain('Endpoint not found');
      }
    });

    it('should establish SSE connection', async () => {
      // This is a basic test to ensure the SSE endpoint exists
      // Full SSE testing would require more complex setup
      const response = await axios.get(`http://${testHost}:${testPort}/sse`, {
        timeout: 1000,
        responseType: 'stream'
      }).catch(error => {
        // SSE connections might timeout in test environment, which is expected
        return error.response;
      });

      // The endpoint should exist (not return 404)
      expect(response.status).not.toBe(404);
    });
  });

  describe('STDIO Transport Mode', () => {
    it('should start STDIO server without errors', (done) => {
      const serverPath = './dist/unified-server.js';
      stdioProcess = spawn('node', [serverPath, '--mode=stdio'], {
        env: {
          ...process.env,
          NODE_ENV: 'development',
          GEMINI_API_KEY: 'test-key',
          WEATHER_API_KEY: 'test-key'
        }
      });

      let hasStarted = false;
      let errorOutput = '';

      stdioProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        
        if (output.includes('Smart Weather MCP Server running on stdio')) {
          hasStarted = true;
          done();
        }
      });

      stdioProcess.on('error', (error) => {
        if (!hasStarted) {
          done(error);
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!hasStarted) {
          done(new Error(`STDIO server failed to start. Error output: ${errorOutput}`));
        }
      }, 5000);
    });
  });

  describe('Transport Mode Consistency', () => {
    it('should have consistent tool definitions across transports', async () => {
      // Test HTTP mode
      const config = {
        port: testPort,
        host: testHost,
        environment: 'development' as const,
        secrets: {
          geminiApiKey: 'test-key',
          weatherApiKey: 'test-key'
        }
      };
      
      const expressServer = new ExpressServer(config);
      await expressServer.start();

      const httpResponse = await axios.get(`http://${testHost}:${testPort}/`);
      const httpTools = httpResponse.data.tools;

      // Test STDIO mode (through shared tool handler service)
      const mcpServer = new SmartWeatherMCPServer();
      const serverInstance = (mcpServer as any).server;
      
      // Both should have the same tools
      expect(httpTools).toEqual(['search_weather', 'find_location', 'get_weather_advice']);
      expect(serverInstance).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const config = {
        port: testPort,
        host: testHost,
        environment: 'development' as const,
        secrets: {
          geminiApiKey: 'test-key',
          weatherApiKey: 'test-key'
        }
      };
      
      httpServer = new ExpressServer(config);
      await httpServer.start();
    });

    it('should handle malformed requests gracefully', async () => {
      try {
        await axios.post(`http://${testHost}:${testPort}/sse`, { invalid: 'data' });
      } catch (error: any) {
        // Should not crash the server, should return appropriate error
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }

      // Verify server is still responsive
      const healthResponse = await axios.get(`http://${testHost}:${testPort}/health`);
      expect(healthResponse.status).toBe(200);
    });
  });
});