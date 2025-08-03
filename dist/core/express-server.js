import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { SmartWeatherMCPServer } from './mcp-server.js';
export class ExpressServer {
    app;
    config;
    mcpServer;
    constructor(config) {
        this.app = express();
        this.config = config;
        this.mcpServer = new SmartWeatherMCPServer();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
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
    setupRoutes() {
        // Health check endpoint for Cloud Run
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'smart-weather-mcp-server',
                version: '1.0.0',
                environment: this.config.environment,
            });
        });
        // Root endpoint
        this.app.get('/', (req, res) => {
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
        this.app.get('/sse', async (req, res) => {
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
                const server = new Server({
                    name: 'smart-weather-mcp-server',
                    version: '1.0.0',
                }, {
                    capabilities: {
                        tools: {},
                    },
                });
                // Set up the same handlers as the main MCP server
                await this.setupMCPServerHandlers(server);
                // Connect the transport
                await server.connect(transport);
                console.log('MCP server connected via SSE');
                // Handle client disconnect
                req.on('close', () => {
                    console.log('SSE connection closed');
                });
            }
            catch (error) {
                console.error('SSE connection error:', error);
                res.status(500).json({
                    error: 'Failed to establish SSE connection',
                    details: error instanceof Error ? error.message : String(error),
                });
            }
        });
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                availableEndpoints: ['/', '/health', '/sse'],
            });
        });
        // Error handler
        this.app.use((err, req, res, next) => {
            console.error('Express server error:', err);
            res.status(500).json({
                error: 'Internal server error',
                details: this.config.environment === 'development' ? err.message : 'Something went wrong',
            });
        });
    }
    async setupMCPServerHandlers(server) {
        // Import the handlers from the main MCP server
        // For now, we'll duplicate the setup logic
        const { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } = await import('@modelcontextprotocol/sdk/types.js');
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'search_weather',
                        description: 'Search for current weather, forecast, or historical weather data using natural language',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Natural language weather query',
                                },
                                context: {
                                    type: 'object',
                                    description: 'Additional context for the weather query',
                                    additionalProperties: true,
                                },
                            },
                            required: ['query'],
                        },
                    },
                    {
                        name: 'find_location',
                        description: 'Find and confirm location details for weather queries',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Location search query',
                                },
                                context: {
                                    type: 'object',
                                    description: 'Additional context for location search',
                                    additionalProperties: true,
                                },
                            },
                            required: ['query'],
                        },
                    },
                    {
                        name: 'get_weather_advice',
                        description: 'Get personalized weather advice and recommendations',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Request for weather advice',
                                },
                                context: {
                                    type: 'object',
                                    description: 'Context for weather advice',
                                    additionalProperties: true,
                                },
                            },
                            required: ['query'],
                        },
                    },
                ],
            };
        });
        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                // Phase 1: Basic placeholder implementations
                const query = args;
                switch (name) {
                    case 'search_weather':
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Weather search placeholder - Query: "${query.query}"${query.context ? `, Context: ${JSON.stringify(query.context)}` : ''}`,
                                },
                            ],
                        };
                    case 'find_location':
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Location search placeholder - Query: "${query.query}"${query.context ? `, Context: ${JSON.stringify(query.context)}` : ''}`,
                                },
                            ],
                        };
                    case 'get_weather_advice':
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Weather advice placeholder - Query: "${query.query}"${query.context ? `, Context: ${JSON.stringify(query.context)}` : ''}`,
                                },
                            ],
                        };
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    async start() {
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
//# sourceMappingURL=express-server.js.map