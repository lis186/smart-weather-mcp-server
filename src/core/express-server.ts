import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { SmartWeatherMCPServer } from './mcp-server.js';
import { ServerConfig } from '../types/index.js';
import { logger } from '../services/logger.js';

interface SSEConnection {
  id: string;
  server: Server;
  transport: SSEServerTransport;
  createdAt: Date;
  lastActivity: Date;
}

export class ExpressServer {
  private app: express.Application;
  private config: ServerConfig;
  private mcpServer: SmartWeatherMCPServer;
  private sseConnections: Map<string, SSEConnection> = new Map();
  private connectionCleanupInterval: NodeJS.Timeout | undefined;

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
        const connectionId = this.generateConnectionId();
        logger.sseConnectionEstablished(connectionId, this.sseConnections.size + 1);
        
        // Check connection limits
        if (this.sseConnections.size >= 100) { // Limit concurrent connections
          res.status(503).json({
            error: 'Server busy',
            details: 'Maximum number of concurrent connections reached'
          });
          return;
        }

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
        
        // Reuse MCP server instance or create new one (connection pooling)
        const server = this.createOrReuseMCPServer(connectionId);

        // Set up the same handlers as the main MCP server
        await this.setupMCPServerHandlers(server);
        
        // Connect the transport
        await server.connect(transport);
        
        // Store connection for management
        const connection: SSEConnection = {
          id: connectionId,
          server,
          transport,
          createdAt: new Date(),
          lastActivity: new Date()
        };
        this.sseConnections.set(connectionId, connection);
        
        logger.info('MCP server connected via SSE', {
          connectionId,
          activeConnections: this.sseConnections.size
        });

        // Handle client disconnect
        req.on('close', () => {
          logger.sseConnectionClosed(connectionId, this.sseConnections.size - 1);
          this.cleanupConnection(connectionId);
        });

        // Handle connection errors
        req.on('error', (error) => {
          logger.error('SSE connection error', { connectionId }, error);
          this.cleanupConnection(connectionId);
        });

      } catch (error) {
        logger.error('Failed to establish SSE connection', {}, error instanceof Error ? error : new Error(String(error)));
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to establish SSE connection',
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
        availableEndpoints: ['/', '/health', '/sse'],
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

  private generateConnectionId(): string {
    return `sse-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private createOrReuseMCPServer(connectionId: string): Server {
    // For now, create a new server for each connection
    // In the future, this could implement actual connection pooling/reuse
    return new Server(
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
  }

  private cleanupConnection(connectionId: string): void {
    const connection = this.sseConnections.get(connectionId);
    if (connection) {
      try {
        // Close the server connection if possible
        // Note: MCP SDK might not have explicit close method
        this.sseConnections.delete(connectionId);
        logger.connectionCleanup(connectionId, 'manual cleanup');
      } catch (error) {
        logger.error('Error during connection cleanup', { connectionId }, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private startConnectionCleanup(): void {
    // Clean up stale connections every 5 minutes
    this.connectionCleanupInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 30 * 60 * 1000; // 30 minutes

      for (const [connectionId, connection] of this.sseConnections.entries()) {
        const timeSinceLastActivity = now.getTime() - connection.lastActivity.getTime();
        if (timeSinceLastActivity > staleThreshold) {
          logger.connectionCleanup(connectionId, `stale connection (${timeSinceLastActivity}ms inactive)`);
          this.cleanupConnection(connectionId);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private stopConnectionCleanup(): void {
    if (this.connectionCleanupInterval) {
      clearInterval(this.connectionCleanupInterval);
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(this.config.port, this.config.host, () => {
        logger.serverStarted(this.config.host, this.config.port, this.config.environment);
        resolve();
      });

      server.on('error', (error) => {
        logger.error('Express server startup error', { host: this.config.host, port: this.config.port }, error);
        process.exit(1);
      });
    });
  }
}