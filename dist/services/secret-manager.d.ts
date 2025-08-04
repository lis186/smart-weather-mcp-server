import { ServerConfig } from '../types/index.js';
export declare class SecretManager {
    private projectId;
    private environment;
    private client;
    constructor();
    loadSecrets(): Promise<ServerConfig['secrets']>;
    private loadDevelopmentSecrets;
    private loadProductionSecrets;
    private getSecretValue;
    validateSecrets(secrets: ServerConfig['secrets']): Promise<boolean>;
    getSecret(name: string): Promise<string | undefined>;
}
//# sourceMappingURL=secret-manager.d.ts.map