import { SecretManager } from '../../../src/services/secret-manager';

// Mock Google Cloud Secret Manager
const mockAccessSecretVersion = jest.fn();
jest.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: jest.fn().mockImplementation(() => ({
    accessSecretVersion: mockAccessSecretVersion
  }))
}));

describe('SecretManager', () => {
  let secretManager: SecretManager;

  beforeEach(() => {
    // Clear environment variables first
    delete process.env.GEMINI_API_KEY;
    delete process.env.WEATHER_API_KEY;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.NODE_ENV;
    
    // Create new instance after clearing environment
    secretManager = new SecretManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadSecrets', () => {
    it('should load secrets from environment variables in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.WEATHER_API_KEY = 'test-weather-key';
      
      const devSecretManager = new SecretManager();
      const secrets = await devSecretManager.loadSecrets();

      expect(secrets).toEqual({
        geminiApiKey: 'test-gemini-key',
        weatherApiKey: 'test-weather-key'
      });
    });

    it('should attempt to load from Secret Manager in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

      mockAccessSecretVersion
        .mockResolvedValueOnce([{ payload: { data: Buffer.from('prod-gemini-key') } }])
        .mockResolvedValueOnce([{ payload: { data: Buffer.from('prod-weather-key') } }]);

      const prodSecretManager = new SecretManager();
      const secrets = await prodSecretManager.loadSecrets();

      expect(secrets).toEqual({
        geminiApiKey: 'prod-gemini-key',
        weatherApiKey: 'prod-weather-key'
      });
    });

    it('should return undefined for secrets when Secret Manager access fails', async () => {
      process.env.NODE_ENV = 'production';
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
      process.env.GEMINI_API_KEY = 'fallback-gemini-key';
      process.env.WEATHER_API_KEY = 'fallback-weather-key';

      // Clear previous mocks and set new behavior - secret access fails but doesn't throw
      mockAccessSecretVersion.mockReset();
      mockAccessSecretVersion.mockResolvedValue([{ payload: { data: null } }]); // Invalid data

      const prodSecretManager = new SecretManager();
      const secrets = await prodSecretManager.loadSecrets();

      // When secrets fail to load from Secret Manager but don't throw, they return undefined
      expect(secrets).toEqual({
        geminiApiKey: undefined,
        weatherApiKey: undefined
      });
    });

    it('should fallback to environment variables when Secret Manager client fails completely', async () => {
      process.env.NODE_ENV = 'production';
      // Don't set GOOGLE_CLOUD_PROJECT to simulate client initialization failure
      process.env.GEMINI_API_KEY = 'fallback-gemini-key';
      process.env.WEATHER_API_KEY = 'fallback-weather-key';

      const prodSecretManager = new SecretManager();
      const secrets = await prodSecretManager.loadSecrets();

      // When Secret Manager client is not initialized, falls back to env vars
      expect(secrets).toEqual({
        geminiApiKey: 'fallback-gemini-key',
        weatherApiKey: 'fallback-weather-key'
      });
    });

    it('should return undefined for missing secrets', async () => {
      process.env.NODE_ENV = 'development';
      // No environment variables set

      const devSecretManager = new SecretManager();
      const secrets = await devSecretManager.loadSecrets();

      expect(secrets).toEqual({
        geminiApiKey: undefined,
        weatherApiKey: undefined
      });
    });
  });

  describe('validateSecrets', () => {
    it('should return true when all required secrets are present', async () => {
      const secrets = {
        geminiApiKey: 'test-key',
        weatherApiKey: 'test-key'
      };

      const isValid = await secretManager.validateSecrets(secrets);

      expect(isValid).toBe(true);
    });

    it('should return true in development even when geminiApiKey is missing', async () => {
      process.env.NODE_ENV = 'development';
      const devSecretManager = new SecretManager();
      
      const secrets = {
        geminiApiKey: undefined,
        weatherApiKey: 'test-key'
      };

      const isValid = await devSecretManager.validateSecrets(secrets);

      expect(isValid).toBe(true); // Development allows missing secrets
    });

    it('should return false in production when geminiApiKey is missing', async () => {
      process.env.NODE_ENV = 'production';
      const prodSecretManager = new SecretManager();
      
      const secrets = {
        geminiApiKey: undefined,
        weatherApiKey: 'test-key'
      };

      const isValid = await prodSecretManager.validateSecrets(secrets);

      expect(isValid).toBe(false);
    });

    it('should return true in development even when weatherApiKey is missing', async () => {
      process.env.NODE_ENV = 'development';
      const devSecretManager = new SecretManager();
      
      const secrets = {
        geminiApiKey: 'test-key',
        weatherApiKey: undefined
      };

      const isValid = await devSecretManager.validateSecrets(secrets);

      expect(isValid).toBe(true); // Development allows missing secrets
    });

    it('should return false in production when weatherApiKey is missing', async () => {
      process.env.NODE_ENV = 'production';
      const prodSecretManager = new SecretManager();
      
      const secrets = {
        geminiApiKey: 'test-key',
        weatherApiKey: undefined
      };

      const isValid = await prodSecretManager.validateSecrets(secrets);

      expect(isValid).toBe(false);
    });

    it('should return true in development even when both secrets are missing', async () => {
      process.env.NODE_ENV = 'development';
      const devSecretManager = new SecretManager();
      
      const secrets = {
        geminiApiKey: undefined,
        weatherApiKey: undefined
      };

      const isValid = await devSecretManager.validateSecrets(secrets);

      expect(isValid).toBe(true); // Development allows missing secrets
    });

    it('should return false in production when both secrets are missing', async () => {
      process.env.NODE_ENV = 'production';
      const prodSecretManager = new SecretManager();
      
      const secrets = {
        geminiApiKey: undefined,
        weatherApiKey: undefined
      };

      const isValid = await prodSecretManager.validateSecrets(secrets);

      expect(isValid).toBe(false);
    });
  });

  describe('getSecretValue', () => {
    it('should retrieve secret successfully', async () => {
      process.env.NODE_ENV = 'production';
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
      
      const secretValue = 'test-secret-value';
      mockAccessSecretVersion.mockResolvedValue([{
        payload: { data: Buffer.from(secretValue) }
      }]);

      const prodSecretManager = new SecretManager();
      const result = await (prodSecretManager as any).getSecretValue('test-secret');

      expect(result).toBe(secretValue);
      expect(mockAccessSecretVersion).toHaveBeenCalledWith({
        name: 'projects/test-project/secrets/test-secret/versions/latest'
      });
    });

    it('should return undefined when secret access fails', async () => {
      process.env.NODE_ENV = 'production';
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
      
      mockAccessSecretVersion.mockRejectedValue(new Error('Access denied'));

      const prodSecretManager = new SecretManager();
      const result = await (prodSecretManager as any).getSecretValue('test-secret');

      expect(result).toBeUndefined();
    });

    it('should return undefined when project ID is missing', async () => {
      process.env.NODE_ENV = 'production';
      // Don't set GOOGLE_CLOUD_PROJECT

      const prodSecretManager = new SecretManager();
      const result = await (prodSecretManager as any).getSecretValue('test-secret');

      expect(result).toBeUndefined();
    });
  });
});