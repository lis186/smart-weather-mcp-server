import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { SmartWeatherMCPServer } from './mcp-server.js';
import { ServerConfig } from '../types/index.js';

export class ExpressServer {
  private app: express.Application;
  private config: ServerConfig;
  private mcpServer: SmartWeatherMCPServer;

  constructor(config: ServerConfig) {
    this.app = express();
    this.config = config;
    this.mcpServer = new SmartWeatherMCPServer();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS for development
    if (this.config.environment === 'development') {
      this.app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Health check endpoint for Cloud Run
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'smart-weather-mcp-server',
        version: '1.0.0',
        environment: this.config.environment,
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Smart Weather MCP Server',
        version: '1.0.0',
        description: 'AI-powered weather query MCP server with natural language understanding',
        endpoints: {
          health: '/health',
          sse: '/sse',
        },
        tools: [
          'search_weather',
          'find_location', 
          'get_weather_advice',
        ],
      });
    });

    // SSE endpoint for MCP client connections
    this.app.get('/sse', async (req: Request, res: Response) => {
      try {
        console.log('SSE connection established');
        
        // Set up SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
        });

        // Create SSE transport
        const transport = new SSEServerTransport('/sse', res);
        
        // Create a new MCP server instance for this connection
        const server = new Server(
          {
            name: 'smart-weather-mcp-server',
            version: '1.0.0',
          },
          {
            capabilities: {
              tools: {},
            },
          }
        );

        // Set up the same handlers as the main MCP server
        await this.setupMCPServerHandlers(server);
        
        // Connect the transport
        await server.connect(transport);
        
        console.log('MCP server connected via SSE');

        // Handle client disconnect
        req.on('close', () => {
          console.log('SSE connection closed');
        });

      } catch (error) {
        console.error('SSE connection error:', error);
        res.status(500).json({
          error: 'Failed to establish SSE connection',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        availableEndpoints: ['/', '/health', '/sse'],
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
      console.error('Express server error:', err);
      res.status(500).json({
        error: 'Internal server error',
        details: this.config.environment === 'development' ? err.message : 'Something went wrong',
      });
    });
  }

  private async setupMCPServerHandlers(server: Server): Promise<void> {
    // Use shared tool handler service to avoid code duplication
    const { ToolHandlerService } = await import('../services/tool-handlers.js');
    ToolHandlerService.setupServerHandlers(server);
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(this.config.port, this.config.host, () => {
        console.log(`Smart Weather MCP Server running on http://${this.config.host}:${this.config.port}`);
        console.log(`Health check: http://${this.config.host}:${this.config.port}/health`);
        console.log(`SSE endpoint: http://${this.config.host}:${this.config.port}/sse`);
        console.log(`Environment: ${this.config.environment}`);
        resolve();
      });

      server.on('error', (error) => {
        console.error('Express server error:', error);
        process.exit(1);
      });
    });
  }
}