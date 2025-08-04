#!/usr/bin/env node
/**
 * MCP Server for STDIO transport (Claude Desktop)
 * This is a separate entry point for Claude Desktop integration
 */
import 'dotenv/config';
import { SmartWeatherMCPServer } from './core/mcp-server.js';
import { SecretManager } from './services/secret-manager.js';
async function startMCPServer() {
    try {
        // Load secrets
        const secretManager = new SecretManager();
        const secrets = await secretManager.loadSecrets();
        const secretsValid = await secretManager.validateSecrets(secrets);
        if (!secretsValid && process.env.NODE_ENV === 'production') {
            console.error('Failed to validate required secrets in production environment');
            process.exit(1);
        }
        // Start MCP server
        const mcpServer = new SmartWeatherMCPServer();
        await mcpServer.run();
    }
    catch (error) {
        console.error('Failed to start MCP server:', error);
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
// Start the MCP server
startMCPServer().catch((error) => {
    console.error('MCP server startup failed:', error);
    process.exit(1);
});
//# sourceMappingURL=mcp-stdio.js.map