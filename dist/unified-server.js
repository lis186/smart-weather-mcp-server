#!/usr/bin/env node
/**
 * Unified Smart Weather MCP Server
 * Supports multiple transport modes: STDIO, HTTP/SSE
 * Usage:
 *   node dist/unified-server.js --mode=stdio
 *   node dist/unified-server.js --mode=http --port=8080
 *   node dist/unified-server.js --mode=http --host=0.0.0.0 --port=8080
 */
import 'dotenv/config';
import { SmartWeatherMCPServer } from './core/mcp-server.js';
import { ExpressServer } from './core/express-server.js';
import { SecretManager } from './services/secret-manager.js';
function parseArgs() {
    const args = {
        mode: 'stdio', // Default to STDIO for Claude Desktop compatibility
    };
    process.argv.slice(2).forEach(arg => {
        if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
        else if (arg.startsWith('--mode=')) {
            const mode = arg.split('=')[1];
            if (mode === 'stdio' || mode === 'http') {
                args.mode = mode;
            }
            else {
                console.error(`Invalid mode: ${mode}. Use 'stdio' or 'http'`);
                process.exit(1);
            }
        }
        else if (arg.startsWith('--port=')) {
            args.port = parseInt(arg.split('=')[1], 10);
            if (isNaN(args.port)) {
                console.error(`Invalid port: ${arg.split('=')[1]}`);
                process.exit(1);
            }
        }
        else if (arg.startsWith('--host=')) {
            args.host = arg.split('=')[1];
        }
    });
    return args;
}
function showHelp() {
    console.log(`
Smart Weather MCP Server - Unified Transport

Usage:
  node dist/unified-server.js [options]

Options:
  --mode=<stdio|http>     Transport mode (default: stdio)
  --host=<host>          Host to bind (default: 0.0.0.0, HTTP mode only)
  --port=<port>          Port to listen (default: 8080, HTTP mode only)
  --help, -h             Show this help

Examples:
  # STDIO mode (for Claude Desktop)
  node dist/unified-server.js --mode=stdio

  # HTTP/SSE mode (for web clients)
  node dist/unified-server.js --mode=http --port=8080

  # HTTP mode with custom host
  node dist/unified-server.js --mode=http --host=localhost --port=3000

Environment Variables:
  NODE_ENV               development|production
  GEMINI_API_KEY         Google Gemini API key
  WEATHER_API_KEY        Weather API key
  GOOGLE_CLOUD_PROJECT   Google Cloud project ID
`);
}
async function startSTDIOServer() {
    try {
        // Load secrets (but log to stderr to avoid polluting STDIO)
        const secretManager = new SecretManager();
        const secrets = await secretManager.loadSecrets();
        const secretsValid = await secretManager.validateSecrets(secrets);
        if (!secretsValid && process.env.NODE_ENV === 'production') {
            console.error('Failed to validate required secrets in production environment');
            process.exit(1);
        }
        // Start MCP server with STDIO transport
        const mcpServer = new SmartWeatherMCPServer();
        await mcpServer.run();
    }
    catch (error) {
        console.error('Failed to start STDIO MCP server:', error);
        process.exit(1);
    }
}
async function startHTTPServer(host, port) {
    try {
        // Load configuration
        const config = {
            port,
            host,
            environment: process.env.NODE_ENV || 'development',
        };
        console.log('Starting Smart Weather MCP Server in HTTP mode...');
        console.log(`Environment: ${config.environment}`);
        console.log(`Server will listen on ${config.host}:${config.port}`);
        // Initialize Secret Manager
        const secretManager = new SecretManager();
        const secrets = await secretManager.loadSecrets();
        const secretsValid = await secretManager.validateSecrets(secrets);
        if (!secretsValid && config.environment === 'production') {
            console.error('Failed to validate required secrets in production environment');
            process.exit(1);
        }
        config.secrets = secrets;
        // Start Express server with HTTP/SSE transport
        const expressServer = new ExpressServer(config);
        await expressServer.start();
        console.log('Smart Weather MCP Server started successfully in HTTP mode');
    }
    catch (error) {
        console.error('Failed to start HTTP MCP server:', error);
        process.exit(1);
    }
}
async function main() {
    const args = parseArgs();
    if (args.help) {
        showHelp();
        process.exit(0);
    }
    // Graceful shutdown handling
    const shutdown = async (signal) => {
        console.error(`Received ${signal}, shutting down gracefully...`);
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        process.exit(1);
    });
    // Start server based on mode
    switch (args.mode) {
        case 'stdio':
            await startSTDIOServer();
            break;
        case 'http':
            const host = args.host || '0.0.0.0';
            const port = args.port || 8080;
            await startHTTPServer(host, port);
            break;
        default:
            console.error(`Unknown mode: ${args.mode}`);
            process.exit(1);
    }
}
// Start the server
main().catch((error) => {
    console.error('Server startup failed:', error);
    process.exit(1);
});
//# sourceMappingURL=unified-server.js.map