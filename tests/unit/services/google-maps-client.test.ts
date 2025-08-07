/**
 * Google Maps Client Unit Tests
 * Tests geocoding and maps API integration
 */

import axios from 'axios';
import { GoogleMapsClient } from '../../../src/services/google-maps-client.js';
import type { WeatherAPIConfig, LocationQuery, Location } from '../../../src/types/weather-api.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock axios.create
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn()
    },
    response: {
      use: jest.fn()
    }
  }
};

describe('GoogleMapsClient', () => {
  let client: GoogleMapsClient;
  let config: WeatherAPIConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock axios.create to return our mock instance
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    // Setup test configuration
    config = {
      apiKey: 'test-api-key',
      timeout: 5000,
      retryAttempts: 2
    };

    client = new GoogleMapsClient(config);
  });

  describe('Client Initialization', () => {
    it('should initialize with provided config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://maps.googleapis.com/maps/api',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Smart-Weather-MCP-Server/1.0'
        }
      });
    });

    it('should setup request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should use default values for missing config', () => {
      const minimalConfig = { apiKey: 'test-key' };
      const minimalClient = new GoogleMapsClient(minimalConfig);
      
      expect(mockedAxios.create).toHaveBeenLastCalledWith({
        baseURL: 'https://maps.googleapis.com/maps/api',
        timeout: 5000, // default
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Smart-Weather-MCP-Server/1.0'
        }
      });
    });
  });

  describe('Geocoding API', () => {
    const mockGeocodingResponse = {
      data: {
        results: [
          {
            formatted_address: 'Taipei, Taiwan',
            geometry: {
              location: {
                lat: 25.0330,
                lng: 121.5654
              }
            },
            address_components: [
              {
                long_name: 'Taipei',
                short_name: 'Taipei',
                types: ['locality', 'political']
              },
              {
                long_name: 'Taiwan',
                short_name: 'TW',
                types: ['country', 'political']
              }
            ],
            types: ['locality', 'political']
          }
        ],
        status: 'OK'
      }
    };

    it('should geocode address successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockGeocodingResponse);

      const query: LocationQuery = {
        query: 'Taipei, Taiwan',
        language: 'en'
      };

      const result = await client.geocode(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].location.latitude).toBe(25.0330);
      expect(result.data![0].location.longitude).toBe(121.5654);
      expect(result.data![0].formattedAddress).toBe('Taipei, Taiwan');
      expect(result.data![0].confidence).toBeGreaterThan(0);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/geocode/json', {
        params: {
          address: 'Taipei, Taiwan',
          language: 'en'
        }
      });
    });

    it('should handle geocoding with location bias', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockGeocodingResponse);

      const query: LocationQuery = {
        query: 'Central Station',
        bias: {
          latitude: 25.0330,
          longitude: 121.5654,
          radius: 5000
        },
        language: 'en'
      };

      await client.geocode(query);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/geocode/json', {
        params: {
          address: 'Central Station',
          language: 'en',
          region: '25.033,121.5654',
          radius: 5000
        }
      });
    });

    it('should handle geocoding API errors', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            error_message: 'Invalid request'
          }
        }
      };
      
      mockAxiosInstance.get.mockRejectedValue(error);

      const query: LocationQuery = {
        query: 'Invalid Location',
        language: 'en'
      };

      const result = await client.geocode(query);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('INVALID_REQUEST');
      expect(result.error!.message).toBe('Invalid request parameters');
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        request: {},
        message: 'Network Error'
      });

      const query: LocationQuery = {
        query: 'Test Location',
        language: 'en'
      };

      const result = await client.geocode(query);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NETWORK_ERROR');
      expect((result.error as any)!.retryable).toBe(true);
    });
  });

  describe('Reverse Geocoding', () => {
    const mockReverseGeocodingResponse = {
      data: {
        results: [
          {
            formatted_address: '101 Section 5, Xinyi Rd, Xinyi District, Taipei City, Taiwan',
            geometry: {
              location: {
                lat: 25.0336,
                lng: 121.5650
              }
            },
            address_components: [
              {
                long_name: 'Xinyi District',
                short_name: 'Xinyi District',
                types: ['administrative_area_level_1', 'political']
              },
              {
                long_name: 'Taiwan',
                short_name: 'TW',
                types: ['country', 'political']
              }
            ],
            types: ['street_address']
          }
        ],
        status: 'OK'
      }
    };

    it('should reverse geocode coordinates successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockReverseGeocodingResponse);

      const location: Location = {
        latitude: 25.0336,
        longitude: 121.5650
      };

      const result = await client.reverseGeocode(location);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].location.latitude).toBe(25.0336);
      expect(result.data![0].location.longitude).toBe(121.5650);
      expect(result.data![0].formattedAddress).toContain('Taipei');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/geocode/json', {
        params: {
          latlng: '25.0336,121.565',
          language: 'en'
        }
      });
    });

    it('should calculate confidence scores correctly', async () => {
      const testCases = [
        { types: ['street_address'], expectedConfidence: 0.95 },
        { types: ['premise'], expectedConfidence: 0.90 },
        { types: ['point_of_interest'], expectedConfidence: 0.85 },
        { types: ['locality'], expectedConfidence: 0.80 },
        { types: ['administrative_area_level_1'], expectedConfidence: 0.70 },
        { types: ['country'], expectedConfidence: 0.60 },
        { types: ['other'], expectedConfidence: 0.50 }
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          data: {
            results: [{
              formatted_address: 'Test Address',
              geometry: { location: { lat: 25.0, lng: 121.0 } },
              address_components: [],
              types: testCase.types
            }],
            status: 'OK'
          }
        };

        mockAxiosInstance.get.mockResolvedValue(mockResponse);

        const location: Location = { latitude: 25.0, longitude: 121.0 };
        const result = await client.reverseGeocode(location);

        expect(result.success).toBe(true);
        expect(result.data![0].confidence).toBe(testCase.expectedConfidence);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 Unauthorized errors', async () => {
      const error = {
        response: {
          status: 401,
          data: {
            error_message: 'Invalid API key'
          }
        }
      };
      
      mockAxiosInstance.get.mockRejectedValue(error);

      const query: LocationQuery = { query: 'test', language: 'en' };
      const result = await client.geocode(query);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('INVALID_API_KEY');
      expect((result.error as any)!.retryable).toBe(false);
    });

    it('should handle 403 Forbidden errors', async () => {
      const error = {
        response: {
          status: 403,
          data: {
            error_message: 'Quota exceeded'
          }
        }
      };
      
      mockAxiosInstance.get.mockRejectedValue(error);

      const query: LocationQuery = { query: 'test', language: 'en' };
      const result = await client.geocode(query);

      expect(result.error!.code).toBe('API_QUOTA_EXCEEDED');
      expect((result.error as any)!.retryable).toBe(false);
    });

    it('should handle 429 Rate Limited errors', async () => {
      const error = {
        response: {
          status: 429,
          data: {
            error_message: 'Rate limit exceeded'
          }
        }
      };
      
      mockAxiosInstance.get.mockRejectedValue(error);

      const query: LocationQuery = { query: 'test', language: 'en' };
      const result = await client.geocode(query);

      expect(result.error!.code).toBe('RATE_LIMITED');
      expect((result.error as any)!.retryable).toBe(true);
    });

    it('should handle 500 Server errors', async () => {
      const error = {
        response: {
          status: 500,
          data: {
            error_message: 'Internal server error'
          }
        }
      };
      
      mockAxiosInstance.get.mockRejectedValue(error);

      const query: LocationQuery = { query: 'test', language: 'en' };
      const result = await client.geocode(query);

      expect(result.error!.code).toBe('SERVER_ERROR');
      expect((result.error as any)!.retryable).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should retry retryable errors', async () => {
      // First call fails with retryable error
      const retryableError = {
        response: {
          status: 500,
          data: { error_message: 'Server error' }
        }
      };

      // Second call succeeds
      const successResponse = {
        data: {
          results: [{
            formatted_address: 'Test Address',
            geometry: { location: { lat: 25.0, lng: 121.0 } },
            address_components: [],
            types: ['locality']
          }],
          status: 'OK'
        }
      };

      mockAxiosInstance.get
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(successResponse);

      const query: LocationQuery = { query: 'test', language: 'en' };
      const result = await client.geocode(query);

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = {
        response: {
          status: 401,
          data: { error_message: 'Invalid API key' }
        }
      };

      mockAxiosInstance.get.mockRejectedValue(nonRetryableError);

      const query: LocationQuery = { query: 'test', language: 'en' };
      const result = await client.geocode(query);

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('INVALID_API_KEY');
    });

    it('should give up after max retry attempts', async () => {
      const retryableError = {
        response: {
          status: 500,
          data: { error_message: 'Server error' }
        }
      };

      // Mock all calls to fail
      mockAxiosInstance.get.mockRejectedValue(retryableError);

      const query: LocationQuery = { query: 'test', language: 'en' };
      const result = await client.geocode(query);

      // Should try 1 initial + 2 retry attempts = 3 total
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should pass health check when API is available', async () => {
      const successResponse = {
        data: {
          results: [{
            formatted_address: 'New York, NY, USA',
            geometry: { location: { lat: 40.7128, lng: -74.0060 } },
            address_components: [],
            types: ['locality']
          }],
          status: 'OK'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(successResponse);

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/geocode/json', {
        params: {
          address: 'New York',
          key: 'test-api-key'
        },
        timeout: 3000
      });
    });

    it('should fail health check when API is unavailable', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('Usage Statistics', () => {
    it('should return usage statistics', () => {
      const stats = client.getUsageStats();

      expect(stats).toHaveProperty('baseUrl');
      expect(stats).toHaveProperty('timeout');
      expect(stats).toHaveProperty('retryAttempts');
      expect(stats).toHaveProperty('hasApiKey');
      
      expect(stats).toEqual({
        baseUrl: 'https://maps.googleapis.com/maps/api',
        timeout: 5000,
        retryAttempts: 2,
        hasApiKey: true
      });
    });
  });

  describe('Address Component Extraction', () => {
    it('should extract country from address components', async () => {
      const mockResponse = {
        data: {
          results: [{
            formatted_address: 'Tokyo, Japan',
            geometry: { location: { lat: 35.6762, lng: 139.6503 } },
            address_components: [
              {
                long_name: 'Tokyo',
                short_name: 'Tokyo',
                types: ['locality', 'political']
              },
              {
                long_name: 'Japan',
                short_name: 'JP',
                types: ['country', 'political']
              }
            ],
            types: ['locality']
          }],
          status: 'OK'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const query: LocationQuery = { query: 'Tokyo, Japan', language: 'en' };
      const result = await client.geocode(query);

      expect(result.success).toBe(true);
      expect(result.data![0].location.country).toBe('Japan');
    });

    it('should extract region from address components', async () => {
      const mockResponse = {
        data: {
          results: [{
            formatted_address: 'Los Angeles, CA, USA',
            geometry: { location: { lat: 34.0522, lng: -118.2437 } },
            address_components: [
              {
                long_name: 'Los Angeles',
                short_name: 'LA',
                types: ['locality', 'political']
              },
              {
                long_name: 'California',
                short_name: 'CA',
                types: ['administrative_area_level_1', 'political']
              },
              {
                long_name: 'United States',
                short_name: 'US',
                types: ['country', 'political']
              }
            ],
            types: ['locality']
          }],
          status: 'OK'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const query: LocationQuery = { query: 'Los Angeles, CA', language: 'en' };
      const result = await client.geocode(query);

      expect(result.success).toBe(true);
      expect(result.data![0].location.region).toBe('California');
      expect(result.data![0].location.country).toBe('United States');
    });
  });
});