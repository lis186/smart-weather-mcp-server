import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
export class SecretManager {
    projectId;
    environment;
    client;
    constructor() {
        this.projectId = process.env.GOOGLE_CLOUD_PROJECT;
        this.environment = process.env.NODE_ENV || 'development';
        // Initialize Google Cloud Secret Manager client in production
        if (this.environment === 'production' && this.projectId) {
            this.client = new SecretManagerServiceClient();
        }
    }
    async loadSecrets() {
        if (this.environment === 'development') {
            return this.loadDevelopmentSecrets();
        }
        else {
            return this.loadProductionSecrets();
        }
    }
    loadDevelopmentSecrets() {
        // In development, load from environment variables
        console.error('Loading secrets from environment variables (development mode)');
        return {
            geminiApiKey: process.env.GEMINI_API_KEY,
            weatherApiKey: process.env.WEATHER_API_KEY,
        };
    }
    async loadProductionSecrets() {
        if (!this.client || !this.projectId) {
            console.error('Secret Manager client not initialized, falling back to environment variables');
            return {
                geminiApiKey: process.env.GEMINI_API_KEY,
                weatherApiKey: process.env.WEATHER_API_KEY,
            };
        }
        console.error('Loading secrets from Google Cloud Secret Manager');
        try {
            const [geminiSecret, weatherSecret] = await Promise.all([
                this.getSecretValue('gemini-api-key'),
                this.getSecretValue('weather-api-key'),
            ]);
            return {
                geminiApiKey: geminiSecret,
                weatherApiKey: weatherSecret,
            };
        }
        catch (error) {
            console.error('Failed to load secrets from Secret Manager:', error);
            console.error('Falling back to environment variables');
            return {
                geminiApiKey: process.env.GEMINI_API_KEY,
                weatherApiKey: process.env.WEATHER_API_KEY,
            };
        }
    }
    async getSecretValue(secretName) {
        if (!this.client || !this.projectId) {
            return undefined;
        }
        try {
            const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
            const [version] = await this.client.accessSecretVersion({ name });
            if (version.payload?.data) {
                return version.payload.data.toString();
            }
            return undefined;
        }
        catch (error) {
            console.error(`Failed to get secret ${secretName}:`, error);
            return undefined;
        }
    }
    async validateSecrets(secrets) {
        const issues = [];
        if (!secrets?.geminiApiKey) {
            issues.push('GEMINI_API_KEY is missing');
        }
        if (!secrets?.weatherApiKey) {
            issues.push('WEATHER_API_KEY is missing');
        }
        if (issues.length > 0) {
            console.warn('Secret validation issues:', issues);
            if (this.environment === 'production') {
                console.error('Missing required secrets in production environment');
                return false;
            }
            else {
                console.warn('Missing secrets in development environment - some features may not work');
                return true; // Allow development without all secrets
            }
        }
        console.error('All required secrets are available');
        return true;
    }
    async getSecret(name) {
        if (this.environment === 'development') {
            return process.env[name];
        }
        // In production, try Secret Manager first, then fallback to environment variables
        const secretValue = await this.getSecretValue(name);
        return secretValue || process.env[name];
    }
}
//# sourceMappingURL=secret-manager.js.map