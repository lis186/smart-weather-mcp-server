import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SmartWeatherMCPServer } from './mcp-server.js';
import { ServerConfig } from '../types/index.js';
import { logger } from '../services/logger.js';

interface MCPConnection {
  id: string;
  server: Server;
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
  lastActivity: Date;
}

export class ExpressServer {
  private app: express.Application;
  private config: ServerConfig;
  private mcpServer: SmartWeatherMCPServer;
  private mcpConnections: Map<string, MCPConnection> = new Map();
  private connectionCleanupInterval: NodeJS.Timeout | undefined;
  private globalTransport: StreamableHTTPServerTransport | undefined;
  private globalServer: Server | undefined;

  constructor(config: ServerConfig) {
    this.app = express();
    this.config = config;
    this.mcpServer = new SmartWeatherMCPServer();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startConnectionCleanup();
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

  private async setupMCPTransport(): Promise<void> {
    // Create a single StreamableHTTP transport for all connections
    // Using stateless mode for Cloud Run compatibility
    this.globalTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode for Cloud Run
      enableJsonResponse: true,
      enableDnsRebindingProtection: false, // Disable for Cloud Run/remote access
    });

    // Create a single MCP server instance
    this.globalServer = new Server(
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

    // Set up handlers
    await this.setupMCPServerHandlers(this.globalServer);

    // Connect the transport to the server
    await this.globalServer.connect(this.globalTransport);
    
    logger.info('StreamableHTTP transport initialized in stateless mode');
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
          mcp: '/mcp',
        },
        tools: [
          'search_weather',
          'find_location', 
          'get_weather_advice',
        ],
      });
    });

    // Streamable HTTP endpoint for MCP - handles both GET (SSE stream) and POST (messages)
    this.app.all('/mcp', async (req: Request, res: Response) => {
      try {
        if (!this.globalTransport) {
          await this.setupMCPTransport();
        }

        // Let the StreamableHTTP transport handle the request
        // It will automatically handle GET for SSE and POST for messages
        await this.globalTransport!.handleRequest(req, res, req.body);

      } catch (error) {
        logger.error('Failed to handle MCP request', { method: req.method }, error instanceof Error ? error : new Error(String(error)));
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to handle MCP request',
            details: this.config.environment === 'development' 
              ? error instanceof Error ? error.message : String(error)
              : 'Internal server error',
          });
        }
      }
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        availableEndpoints: ['/', '/health', '/mcp'],
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
      logger.error('Express server error', { path: req.path, method: req.method }, err);
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

  private startConnectionCleanup(): void {
    // No longer needed with stateless StreamableHTTP transport
    // Connection management is handled per-request
  }

  private stopConnectionCleanup(): void {
    // No longer needed with stateless StreamableHTTP transport
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(this.config.port, this.config.host, () => {
        logger.serverStarted(this.config.host, this.config.port, this.config.environment);
        resolve();
      });

      server.on('error', (error) => {
        logger.error('Express server startup error', { host: this.config.host, port: this.config.port }, error);
        // Don't exit in test environment - let the test handle the error
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
      });
    });
  }
}