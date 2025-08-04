import { SecretManager } from '../../../src/services/secret-manager.js';

// Mock Google Cloud Secret Manager
jest.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: jest.fn().mockImplementation(() => ({
    accessSecretVersion: jest.fn()
  }))
}));

describe('SecretManager', () => {
  let secretManager: SecretManager;
  let mockSecretClient: any;

  beforeEach(() => {
    secretManager = new SecretManager();
    mockSecretClient = (secretManager as any).client;
    
    // Clear environment variables
    delete process.env.GEMINI_API_KEY;
    delete process.env.WEATHER_API_KEY;
    delete process.env.GOOGLE_CLOUD_PROJECT;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadSecrets', () => {
    it('should load secrets from environment variables in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.WEATHER_API_KEY = 'test-weather-key';

      const secrets = await secretManager.loadSecrets();

      expect(secrets).toEqual({
        geminiApiKey: 'test-gemini-key',
        weatherApiKey: 'test-weather-key'
      });
    });

    it('should attempt to load from Secret Manager in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

      mockSecretClient.accessSecretVersion
        .mockResolvedValueOnce([{ payload: { data: Buffer.from('prod-gemini-key') } }])
        .mockResolvedValueOnce([{ payload: { data: Buffer.from('prod-weather-key') } }]);

      const secrets = await secretManager.loadSecrets();

      expect(secrets).toEqual({
        geminiApiKey: 'prod-gemini-key',
        weatherApiKey: 'prod-weather-key'
      });
    });

    it('should fallback to environment variables when Secret Manager fails', async () => {
      process.env.NODE_ENV = 'production';
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
      process.env.GEMINI_API_KEY = 'fallback-gemini-key';
      process.env.WEATHER_API_KEY = 'fallback-weather-key';

      mockSecretClient.accessSecretVersion.mockRejectedValue(new Error('Secret Manager error'));

      const secrets = await secretManager.loadSecrets();

      expect(secrets).toEqual({
        geminiApiKey: 'fallback-gemini-key',
        weatherApiKey: 'fallback-weather-key'
      });
    });

    it('should return undefined for missing secrets', async () => {
      process.env.NODE_ENV = 'development';
      // No environment variables set

      const secrets = await secretManager.loadSecrets();

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

    it('should return false when geminiApiKey is missing', async () => {
      const secrets = {
        geminiApiKey: undefined,
        weatherApiKey: 'test-key'
      };

      const isValid = await secretManager.validateSecrets(secrets);

      expect(isValid).toBe(false);
    });

    it('should return false when weatherApiKey is missing', async () => {
      const secrets = {
        geminiApiKey: 'test-key',
        weatherApiKey: undefined
      };

      const isValid = await secretManager.validateSecrets(secrets);

      expect(isValid).toBe(false);
    });

    it('should return false when both secrets are missing', async () => {
      const secrets = {
        geminiApiKey: undefined,
        weatherApiKey: undefined
      };

      const isValid = await secretManager.validateSecrets(secrets);

      expect(isValid).toBe(false);
    });
  });

  describe('getSecretValue', () => {
    beforeEach(() => {
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    });

    it('should retrieve secret successfully', async () => {
      const secretValue = 'test-secret-value';
      mockSecretClient.accessSecretVersion.mockResolvedValue([{
        payload: { data: Buffer.from(secretValue) }
      }]);

      const result = await (secretManager as any).getSecretValue('test-secret');

      expect(result).toBe(secretValue);
      expect(mockSecretClient.accessSecretVersion).toHaveBeenCalledWith({
        name: 'projects/test-project/secrets/test-secret/versions/latest'
      });
    });

    it('should return undefined when secret access fails', async () => {
      mockSecretClient.accessSecretVersion.mockRejectedValue(new Error('Access denied'));

      const result = await (secretManager as any).getSecretValue('test-secret');

      expect(result).toBeUndefined();
    });

    it('should return undefined when project ID is missing', async () => {
      delete process.env.GOOGLE_CLOUD_PROJECT;

      const result = await (secretManager as any).getSecretValue('test-secret');

      expect(result).toBeUndefined();
    });
  });
});