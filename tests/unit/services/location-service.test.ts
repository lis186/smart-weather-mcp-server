/**
 * Location Service Unit Tests
 * Tests location search, confirmation, and parsing functionality
 */

import { LocationService } from '../../../src/services/location-service.js';
import { GoogleMapsClient } from '../../../src/services/google-maps-client.js';
import type { WeatherAPIConfig, GeocodingResult } from '../../../src/types/weather-api.js';

// Mock GoogleMapsClient
jest.mock('../../../src/services/google-maps-client.js');
const MockedGoogleMapsClient = GoogleMapsClient as jest.MockedClass<typeof GoogleMapsClient>;

describe('LocationService', () => {
  let locationService: LocationService;
  let mockClient: jest.Mocked<GoogleMapsClient>;

  const mockGeocodingResults: GeocodingResult[] = [
    {
      location: {
        latitude: 25.0330,
        longitude: 121.5654,
        name: 'Taipei, Taiwan',
        country: 'Taiwan',
        region: 'Taipei'
      },
      formattedAddress: 'Taipei, Taiwan',
      addressComponents: [],
      confidence: 0.95
    },
    {
      location: {
        latitude: 25.0400,
        longitude: 121.5700,
        name: 'Taipei Main Station, Taiwan',
        country: 'Taiwan',
        region: 'Taipei'
      },
      formattedAddress: 'Taipei Main Station, Zhongzheng District, Taipei, Taiwan',
      addressComponents: [],
      confidence: 0.85
    }
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock client instance
    mockClient = {
      geocode: jest.fn(),
      reverseGeocode: jest.fn(),
      healthCheck: jest.fn(),
      getUsageStats: jest.fn()
    } as any;

    // Mock the constructor
    MockedGoogleMapsClient.mockImplementation(() => mockClient);

    // Create location service
    const config: WeatherAPIConfig = {
      apiKey: 'test-api-key',
      timeout: 5000
    };

    locationService = new LocationService(config);
  });

  describe('Location Search', () => {

    it('should search locations successfully', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mockGeocodingResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('Taipei');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.location.name).toBe('Taipei, Taiwan');
      expect(result.data!.confidence).toBe(0.95);
      expect(result.data!.source).toBe('exact');
      expect(result.data!.needsConfirmation).toBe(false);
    });

    it('should handle multiple search results with alternatives', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mockGeocodingResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('Taipei', {
        maxResults: 3
      });

      expect(result.success).toBe(true);
      expect(result.data!.alternatives).toBeDefined();
      expect(result.data!.alternatives!.length).toBe(1);
      expect(result.data!.alternatives![0].name).toBe('Taipei Main Station, Taiwan');
    });

    it('should require confirmation for low confidence results', async () => {
      const lowConfidenceResults: GeocodingResult[] = [
        {
          ...mockGeocodingResults[0],
          confidence: 0.6 // Low confidence
        }
      ];

      mockClient.geocode.mockResolvedValue({
        success: true,
        data: lowConfidenceResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('ambiguous location');

      expect(result.success).toBe(true);
      expect(result.data!.needsConfirmation).toBe(true);
      expect(result.data!.source).toBe('suggestion');
    });

    it('should handle location not found', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('nonexistent place');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('LOCATION_NOT_FOUND');
      expect(result.error!.message).toContain('Could not find location');
    });

    it('should handle geocoding API errors', async () => {
      mockClient.geocode.mockResolvedValue({
        success: false,
        error: {
          code: 'API_ERROR',
          message: 'Geocoding failed'
        },
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('test location');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('API_ERROR');
    });

    it('should preprocess queries correctly', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mockGeocodingResults,
        timestamp: new Date().toISOString()
      });

      // Test various query formats
      await locationService.searchLocations('台灣台北，天氣預報');
      
      expect(mockClient.geocode).toHaveBeenCalledWith({
        query: '台灣台北 天氣預報',
        language: 'en'
      });

      // Test abbreviation expansion
      await locationService.searchLocations('NYC weather today');
      
      expect(mockClient.geocode).toHaveBeenCalledWith({
        query: 'New York weather today',
        language: 'en'
      });
    });

    it('should use location bias when provided', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mockGeocodingResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('Central Station', {
        bounds: {
          northeast: { lat: 25.1, lng: 121.6 },
          southwest: { lat: 25.0, lng: 121.5 }
        }
      });

      expect(mockClient.geocode).toHaveBeenCalledWith({
        query: 'Central Station',
        language: 'en',
        bias: {
          latitude: 25.05,
          longitude: 121.55,
          radius: expect.any(Number)
        }
      });
    });
  });

  describe('Location Confirmation', () => {
    it('should confirm location by coordinates', async () => {
      const mockReverseResult: GeocodingResult[] = [
        {
          location: {
            latitude: 25.0330,
            longitude: 121.5654,
            name: 'Taipei 101, Xinyi District, Taipei, Taiwan',
            country: 'Taiwan',
            region: 'Taipei'
          },
          formattedAddress: 'No. 7, Section 5, Xinyi Road, Xinyi District, Taipei City, Taiwan 110',
          addressComponents: [],
          confidence: 0.9
        }
      ];

      mockClient.reverseGeocode.mockResolvedValue({
        success: true,
        data: mockReverseResult,
        timestamp: new Date().toISOString()
      });

      const testLocation = {
        latitude: 25.0330,
        longitude: 121.5654
      };

      const result = await locationService.confirmLocation(testLocation);

      expect(result.success).toBe(true);
      expect(result.data!.location.name).toContain('Taipei 101');
      expect(result.data!.confidence).toBe(0.9);
      expect(result.data!.source).toBe('exact');
      expect(result.data!.needsConfirmation).toBe(false);

      expect(mockClient.reverseGeocode).toHaveBeenCalledWith(testLocation);
    });

    it('should handle reverse geocoding failures', async () => {
      mockClient.reverseGeocode.mockResolvedValue({
        success: false,
        error: {
          code: 'REVERSE_GEOCODING_FAILED',
          message: 'No results found'
        },
        timestamp: new Date().toISOString()
      });

      const testLocation = {
        latitude: 0,
        longitude: 0
      };

      const result = await locationService.confirmLocation(testLocation);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('LOCATION_CONFIRMATION_FAILED');
    });
  });

  describe('Location Extraction from Text', () => {
    it('should extract Chinese location names', () => {
      const text = '台北今天天氣如何？明天東京會下雨嗎？';
      const locations = locationService.extractLocationFromText(text);

      expect(locations).toContain('台北');
      expect(locations).toContain('東京');
      expect(locations).not.toContain('天氣');
      expect(locations).not.toContain('明天');
    });

    it('should extract English location names', () => {
      const text = 'What is the weather in New York today? How about Los Angeles tomorrow?';
      const locations = locationService.extractLocationFromText(text);

      expect(locations).toContain('New York');
      expect(locations).toContain('Los Angeles');
      expect(locations).not.toContain('weather');
      expect(locations).not.toContain('today');
    });

    it('should extract mixed language locations', () => {
      const text = '今天北京的weather如何？Tokyo下雨嗎？';
      const locations = locationService.extractLocationFromText(text);

      expect(locations).toContain('北京');
      expect(locations).toContain('Tokyo');
      expect(locations).not.toContain('weather');
    });

    it('should filter out non-location terms', () => {
      const text = '天氣預報說台北今天會下雨，溫度大概20度';
      const locations = locationService.extractLocationFromText(text);

      expect(locations).toContain('台北');
      expect(locations).not.toContain('天氣');
      expect(locations).not.toContain('預報');
      expect(locations).not.toContain('溫度');
      expect(locations).not.toContain('今天');
    });

    it('should handle empty or no location text', () => {
      expect(locationService.extractLocationFromText('')).toEqual([]);
      expect(locationService.extractLocationFromText('天氣如何？')).toEqual([]);
      expect(locationService.extractLocationFromText('What is the weather like?')).toEqual([]);
    });
  });

  describe('Location Suggestions', () => {
    it('should provide location suggestions', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mockGeocodingResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.getLocationSuggestions('Tai', 3);

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeLessThanOrEqual(3);
      expect(result.data![0].name).toBe('Taipei, Taiwan');
    });

    it('should handle suggestion errors', async () => {
      mockClient.geocode.mockResolvedValue({
        success: false,
        error: {
          code: 'API_ERROR',
          message: 'Failed to get suggestions'
        },
        timestamp: new Date().toISOString()
      });

      const result = await locationService.getLocationSuggestions('test');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('API_ERROR');
    });
  });

  describe('Relevance Scoring', () => {
    it('should rank results by relevance', async () => {
      const mixedQualityResults: GeocodingResult[] = [
        {
          location: { latitude: 25.0, longitude: 121.0, name: 'Generic Taiwan' },
          formattedAddress: 'Taiwan',
          addressComponents: [],
          confidence: 0.5
        },
        {
          location: { latitude: 25.0330, longitude: 121.5654, name: 'Taipei, Taiwan' },
          formattedAddress: 'Taipei, Taiwan',
          addressComponents: [],
          confidence: 0.95
        }
      ];

      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mixedQualityResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('Taipei');

      expect(result.success).toBe(true);
      // Should prioritize the higher confidence result
      expect(result.data!.location.name).toBe('Taipei, Taiwan');
      expect(result.data!.confidence).toBe(0.95);
    });

    it('should boost scores for exact matches', async () => {
      const partialMatchResults: GeocodingResult[] = [
        {
          location: { latitude: 25.0, longitude: 121.0, name: 'Taipei County' },
          formattedAddress: 'Taipei County, Taiwan',
          addressComponents: [],
          confidence: 0.7
        },
        {
          location: { latitude: 25.0330, longitude: 121.5654, name: 'Taipei' },
          formattedAddress: 'Taipei, Taiwan', // Exact match for query
          addressComponents: [],
          confidence: 0.8
        }
      ];

      mockClient.geocode.mockResolvedValue({
        success: true,
        data: partialMatchResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('Taipei');

      expect(result.success).toBe(true);
      expect(result.data!.location.name).toBe('Taipei');
    });

    it('should apply country bias correctly', async () => {
      const multiCountryResults: GeocodingResult[] = [
        {
          location: { latitude: 40.7, longitude: -74.0, name: 'New York, USA', country: 'United States' },
          formattedAddress: 'New York, NY, USA',
          addressComponents: [],
          confidence: 0.8
        },
        {
          location: { latitude: 53.5, longitude: -2.2, name: 'New York, UK', country: 'United Kingdom' },
          formattedAddress: 'New York, Lincolnshire, UK',
          addressComponents: [],
          confidence: 0.7
        }
      ];

      mockClient.geocode.mockResolvedValue({
        success: true,
        data: multiCountryResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('New York', {
        countryBias: 'United Kingdom'
      });

      expect(result.success).toBe(true);
      expect(result.data!.location.country).toBe('United Kingdom');
    });
  });

  describe('Service Management', () => {
    it('should return service capabilities', () => {
      const capabilities = locationService.getCapabilities() as any;

      expect(capabilities).toHaveProperty('search');
      expect(capabilities).toHaveProperty('confirmation');
      expect(capabilities).toHaveProperty('extraction');

      expect(capabilities.search).toHaveProperty('fuzzyMatching', true);
      expect(capabilities.search).toHaveProperty('multipleResults', true);
      expect(capabilities.search).toHaveProperty('confidenceScoring', true);
      expect(capabilities.search.languageSupport).toContain('en');
      expect(capabilities.search.languageSupport).toContain('zh-TW');
    });

    it('should perform health check', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mockGeocodingResults,
        timestamp: new Date().toISOString()
      });

      const isHealthy = await locationService.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockClient.geocode).toHaveBeenCalledWith({
        query: 'New York',
        language: 'en'
      });
    });

    it('should fail health check on API failure', async () => {
      mockClient.geocode.mockRejectedValue(new Error('API failure'));

      const isHealthy = await locationService.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('Strict Mode', () => {
    it('should require confirmation in strict mode', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mockGeocodingResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('Taipei', {
        strictMode: true
      });

      expect(result.success).toBe(true);
      expect(result.data!.needsConfirmation).toBe(true);
    });

    it('should not require confirmation when confidence is very high', async () => {
      const veryHighConfidenceResults: GeocodingResult[] = [
        {
          ...mockGeocodingResults[0],
          confidence: 0.99
        }
      ];

      mockClient.geocode.mockResolvedValue({
        success: true,
        data: veryHighConfidenceResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('Taipei', {
        strictMode: false
      });

      expect(result.success).toBe(true);
      expect(result.data!.needsConfirmation).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short queries', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mockGeocodingResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('NY');

      expect(mockClient.geocode).toHaveBeenCalledWith({
        query: 'New York', // Should expand abbreviation
        language: 'en'
      });
    });

    it('should handle queries with special characters', async () => {
      mockClient.geocode.mockResolvedValue({
        success: true,
        data: mockGeocodingResults,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('臺北，台灣！！！');

      expect(mockClient.geocode).toHaveBeenCalledWith({
        query: 'Taiwan',
        language: 'en'
      });
    });

    it('should handle very long location names', async () => {
      const longNameResult: GeocodingResult[] = [
        {
          location: {
            latitude: 52.5,
            longitude: 5.1,
            name: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch, Wales, UK',
            country: 'United Kingdom'
          },
          formattedAddress: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch, Anglesey LL61, UK',
          addressComponents: [],
          confidence: 0.95
        }
      ];

      mockClient.geocode.mockResolvedValue({
        success: true,
        data: longNameResult,
        timestamp: new Date().toISOString()
      });

      const result = await locationService.searchLocations('Llanfairpwllgwyngyll');

      expect(result.success).toBe(true);
      expect(result.data!.location.name).toContain('Llanfairpwllgwyngyll');
    });
  });
});