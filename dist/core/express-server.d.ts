import { ServerConfig } from '../types/index.js';
export declare class ExpressServer {
    private app;
    private config;
    private mcpServer;
    constructor(config: ServerConfig);
    private setupMiddleware;
    private setupRoutes;
    private setupMCPServerHandlers;
    start(): Promise<void>;
}
//# sourceMappingURL=express-server.d.ts.map