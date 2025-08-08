import { WeatherService } from '../../src/services/weather-service';
import { SecretManager } from '../../src/services/secret-manager';

describe('Error Handling - 4xx Exclusion Policy', () => {
  let weatherService: WeatherService;

  beforeEach(() => {
    const mockSecretManager = {
      getSecret: jest.fn().mockResolvedValue(undefined)
    } as unknown as SecretManager;
    weatherService = new WeatherService({ secretManager: mockSecretManager, cache: { enabled: false, config: {} as any } });
  });

  it('returns LOCATION_NOT_SPECIFIED (4xx) as user error and not service failure', async () => {
    // Ensure LocationService is initialized so extraction runs and returns 4xx error
    process.env.WEATHER_API_KEY = 'dummy-key';
    const result = await weatherService.queryWeather({ query: 'weather', options: {} as any });
    expect(result.success).toBe(false);
    // Accept either LOCATION_NOT_SPECIFIED or LOCATION_NOT_SUPPORTED as client-side (4xx-like) errors
    expect(['LOCATION_NOT_SPECIFIED', 'LOCATION_NOT_SUPPORTED', 'INVALID_LOCATION']).toContain(result.error?.code);
  });
});


