import 'dotenv/config';
import { ExpressServer } from './core/express-server.js';
import { SecretManager } from './services/secret-manager.js';
import { ServerConfig } from './types/index.js';

async function startServer(): Promise<void> {
  try {
    console.log('Starting Smart Weather MCP Server...');

    // Load configuration
    const config: ServerConfig = {
      port: parseInt(process.env.PORT || '8080', 10),
      host: process.env.HOST || '0.0.0.0',
      environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
    };

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

    // Start Express server
    const expressServer = new ExpressServer(config);
    await expressServer.start();

    console.log('Smart Weather MCP Server started successfully');

    // Graceful shutdown handling
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

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

// Start the server
startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});