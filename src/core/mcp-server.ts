import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ToolHandlerService } from '../services/tool-handlers.js';

export class SmartWeatherMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
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

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // Use shared tool handler service to avoid code duplication
    ToolHandlerService.setupServerHandlers(this.server);
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Smart Weather MCP Server running on stdio');
  }
}