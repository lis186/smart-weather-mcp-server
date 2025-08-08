#!/usr/bin/env node

/**
 * Unified Smart Weather MCP Server
 * Supports multiple transport modes: STDIO, Streamable HTTP
 * Usage:
 *   node dist/unified-server.js --mode=stdio
 *   node dist/unified-server.js --mode=http --port=8080
 *   node dist/unified-server.js --mode=http --host=0.0.0.0 --port=8080
 */

import 'dotenv/config';
import { SmartWeatherMCPServer } from './core/mcp-server.js';
import { ExpressServer } from './core/express-server.js';
import { SecretManager } from './services/secret-manager.js';
import { ServerConfig } from './types/index.js';
import { logger } from './services/logger.js';

interface CLIArgs {
  mode: 'stdio' | 'http';
  port?: number;
  host?: string;
  help?: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    mode: 'stdio', // Default to STDIO for Claude Desktop compatibility
  };

  process.argv.slice(2).forEach(arg => {
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('--mode=')) {
      const mode = arg.split('=')[1] as 'stdio' | 'http';
      if (mode === 'stdio' || mode === 'http') {
        args.mode = mode;
      } else {
        logger.error('Invalid mode specified', { mode, validModes: ['stdio', 'http'] });
        process.exit(1);
      }
    } else if (arg.startsWith('--port=')) {
      args.port = parseInt(arg.split('=')[1], 10);
      if (isNaN(args.port)) {
        logger.error('Invalid port specified', { port: arg.split('=')[1] });
        process.exit(1);
      }
    } else if (arg.startsWith('--host=')) {
      args.host = arg.split('=')[1];
    }
  });

  return args;
}

function showHelp(): void {
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

  # Streamable HTTP mode (for web clients)
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

async function startSTDIOServer(): Promise<void> {
  try {
    // Load secrets (but log to stderr to avoid polluting STDIO)
    const secretManager = new SecretManager();
    const secrets = await secretManager.loadSecrets();
    const secretsValid = await secretManager.validateSecrets(secrets);

    if (!secretsValid && process.env.NODE_ENV === 'production') {
      logger.error('Failed to validate required secrets in production environment');
      process.exit(1);
    }

    // Start MCP server with STDIO transport
    const mcpServer = new SmartWeatherMCPServer();
    await mcpServer.run();

  } catch (error) {
    logger.error('Failed to start STDIO MCP server', {}, error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

async function startHTTPServer(host: string, port: number): Promise<void> {
  try {
    // Load configuration
    const config: ServerConfig = {
      port,
      host,
      environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
    };

    logger.info('Starting Smart Weather MCP Server in HTTP mode', {
      environment: config.environment,
      host: config.host,
      port: config.port
    });

    // Initialize Secret Manager
    logger.info('Initializing Secret Manager', { environment: config.environment });
    const secretManager = new SecretManager();
    
    logger.info('Loading secrets...');
    const secrets = await secretManager.loadSecrets();
    
    logger.info('Validating secrets...');
    const secretsValid = await secretManager.validateSecrets(secrets);

    if (!secretsValid) {
      logger.warn('Some secrets validation failed - continuing with available secrets', {
        environment: config.environment,
        secretsLoaded: !!secrets
      });
    }

    config.secrets = secrets;

    // Start Express server with Streamable HTTP transport
    const expressServer = new ExpressServer(config);
    await expressServer.start();

    logger.info('Smart Weather MCP Server started successfully in HTTP mode');

  } catch (error) {
    logger.error('Failed to start HTTP MCP server', {}, error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string): Promise<void> => {
    logger.info('Received shutdown signal, shutting down gracefully', { signal });
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', { promise: String(promise), reason: String(reason) });
    process.exit(1);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {}, error);
    process.exit(1);
  });

  // Start server based on mode
  switch (args.mode) {
    case 'stdio':
      await startSTDIOServer();
      break;

    case 'http':
      const host = args.host || process.env.HOST || '0.0.0.0';
      const port = args.port || parseInt(process.env.PORT || '8080', 10);
      await startHTTPServer(host, port);
      break;

    default:
      logger.error('Unknown mode specified', { mode: args.mode, validModes: ['stdio', 'http'] });
      process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logger.error('Server startup failed', {}, error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});