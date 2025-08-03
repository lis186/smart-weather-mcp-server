import { ServerConfig } from '../types/index.js';

export class SecretManager {
  private projectId: string | undefined;
  private environment: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT;
    this.environment = process.env.NODE_ENV || 'development';
  }

  async loadSecrets(): Promise<ServerConfig['secrets']> {
    if (this.environment === 'development') {
      return this.loadDevelopmentSecrets();
    } else {
      return this.loadProductionSecrets();
    }
  }

  private loadDevelopmentSecrets(): ServerConfig['secrets'] {
    // In development, load from environment variables
    return {
      geminiApiKey: process.env.GEMINI_API_KEY,
      weatherApiKey: process.env.WEATHER_API_KEY,
    };
  }

  private async loadProductionSecrets(): Promise<ServerConfig['secrets']> {
    // Phase 1: Placeholder for Google Cloud Secret Manager integration
    // This will be implemented in Phase 3 when we integrate actual APIs
    
    console.log('Loading secrets from environment variables (Secret Manager integration pending)');
    
    return {
      geminiApiKey: process.env.GEMINI_API_KEY,
      weatherApiKey: process.env.WEATHER_API_KEY,
    };
  }

  async validateSecrets(secrets: ServerConfig['secrets']): Promise<boolean> {
    const issues: string[] = [];

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
      } else {
        console.warn('Missing secrets in development environment - some features may not work');
        return true; // Allow development without all secrets
      }
    }

    console.log('All required secrets are available');
    return true;
  }

  async getSecret(name: string): Promise<string | undefined> {
    if (this.environment === 'development') {
      return process.env[name];
    }

    // Phase 1: Placeholder for actual Secret Manager integration
    // This will be implemented later when we need to access Google Cloud Secret Manager
    return process.env[name];
  }
}