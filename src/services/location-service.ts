/**
 * Location Service
 * Handles location search, confirmation, and intelligent location parsing
 */

import { GoogleMapsClient } from './google-maps-client.js';
import { logger } from './logger.js';
import type {
  WeatherAPIResponse,
  Location,
  LocationQuery,
  GeocodingResult,
  WeatherAPIConfig
} from '../types/weather-api.js';

export interface LocationSearchOptions {
  maxResults?: number;
  language?: string;
  countryBias?: string;
  bounds?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  strictMode?: boolean;
}

export interface LocationConfirmation {
  location: Location;
  confidence: number;
  alternatives?: Location[];
  source: 'exact' | 'fuzzy' | 'suggestion';
  needsConfirmation: boolean;
}

export class LocationService {
  private readonly client: GoogleMapsClient;
  
  // Universal location patterns - supports all languages without hardcoding
  private readonly locationPatterns = [
    // Pattern 1: Universal weather keywords + location extraction
    // Supports: English, Chinese, Spanish, French, German, Russian, Hindi, Korean, Japanese, etc.
    /^(.+?)(?:\s+)?(?:weather|天氣|氣象|forecast|預報|clima|météo|wetter|погoda|मौसम|날씨|天気|tempo|väder|vejr)(?:.*?)(?:\s|$)/i,
    
    // Pattern 2: Location after weather keywords  
    /(?:weather|天氣|氣象|forecast|預報|clima|météo|wetter|погода|मौसम|날씨|天気|tempo|väder|vejr)(?:\s+)(.+?)(?:\s|$)/i,
    
    // Pattern 2.5: Chinese question patterns (台北今天天氣如何？)
    /^([A-Za-z\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+)(?:今天|明天|現在|今日|明日|현재|오늘|내일|きょう|あした)(?:天氣|氣象|날씨|天気)(?:如何|怎樣|怎麼樣|어때|どう)/i,
    
    // Pattern 3: Prepositions + location (multi-language)
    /(?:in|at|for|en|dans|在|à|in|в|में|에서|で|na|em)\s+([A-Za-z\u00C0-\u017F\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f\s]{2,30}?)(?:\s|$|[,.!?])/i,
    
    // Pattern 4: Geographic suffixes (universal)
    /([A-Za-z\u00C0-\u017F\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+(?:市|區|縣|省|州|國|都|府|郡|県|city|town|ville|stadt|ciudad|città|город|नगर|시|도))/i,
    
    // Pattern 5: Capitalized proper nouns (Latin scripts with accents)
    /\b([A-Z][a-zA-Z\u00C0-\u017F]{1,}(?:\s+[A-Z][a-zA-Z\u00C0-\u017F]{1,}){0,3})\b/,
    
    // Pattern 6: CJK characters (Chinese, Japanese, Korean)
    /([\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]{2,})/,
    
    // Pattern 7: Arabic script locations
    /([\u0600-\u06ff]{2,})/,
    
    // Pattern 8: Devanagari script (Hindi, Sanskrit, etc.)
    /([\u0900-\u097f]{2,})/,
    
    // Pattern 9: Generic multi-word locations (fallback)
    /([A-Za-z\u00C0-\u017F\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f]{2,}(?:\s+[A-Za-z\u00C0-\u017F\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f]+){0,2})/
  ];

  constructor(config: WeatherAPIConfig) {
    this.client = new GoogleMapsClient(config);
    logger.info('Location service initialized');
  }

  /**
   * Search for locations based on query string
   */
  async searchLocations(
    query: string,
    options: LocationSearchOptions = {}
  ): Promise<WeatherAPIResponse<LocationConfirmation>> {
    try {
      const cleanQuery = this.preprocessQuery(query);
      
      logger.info('Searching for location', { 
        originalQuery: query,
        cleanQuery,
        options 
      });

      // Build geocoding query
      const geocodingQuery: LocationQuery = {
        query: cleanQuery,
        language: options.language || 'en'
      };

      // Add bias if specified
      if (options.bounds) {
        const center = this.calculateCenter(options.bounds);
        geocodingQuery.bias = {
          latitude: center.lat,
          longitude: center.lng,
          radius: this.calculateRadius(options.bounds)
        };
      }

      // Execute geocoding search
      const geocodingResult = await this.client.geocode(geocodingQuery);

      if (!geocodingResult.success || !geocodingResult.data?.length) {
        return {
          success: false,
          error: {
            code: 'LOCATION_NOT_FOUND',
            message: `Could not find location: ${query}`,
            details: 'Try being more specific or check the spelling'
          },
          timestamp: new Date().toISOString()
        };
      }

      // Process and rank results
      const rankedResults = this.rankLocationResults(
        geocodingResult.data,
        cleanQuery,
        options
      );

      // Determine if confirmation is needed
      const confirmation = this.buildLocationConfirmation(rankedResults, options);

      logger.info('Location search completed', {
        query: cleanQuery,
        resultsCount: rankedResults.length,
        topResult: confirmation.location.name,
        confidence: confirmation.confidence
      });

      return {
        success: true,
        data: confirmation,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('Location search failed', {
        query,
        error: error.message,
        code: error.code
      });

      return {
        success: false,
        error: {
          code: error.code || 'LOCATION_SEARCH_ERROR',
          message: error.message || 'Failed to search for location',
          details: error.details
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Confirm a specific location by coordinates
   */
  async confirmLocation(location: Location): Promise<WeatherAPIResponse<LocationConfirmation>> {
    try {
      logger.info('Confirming location by coordinates', { location });

      const reverseResult = await this.client.reverseGeocode(location);

      if (!reverseResult.success || !reverseResult.data?.length) {
        return {
          success: false,
          error: {
            code: 'LOCATION_CONFIRMATION_FAILED',
            message: 'Could not confirm location',
            details: 'Invalid coordinates or API error'
          },
          timestamp: new Date().toISOString()
        };
      }

      const bestMatch = reverseResult.data[0];
      const confirmation: LocationConfirmation = {
        location: bestMatch.location,
        confidence: bestMatch.confidence,
        source: 'exact',
        needsConfirmation: false
      };

      return {
        success: true,
        data: confirmation,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('Location confirmation failed', {
        location,
        error: error.message
      });

      return {
        success: false,
        error: {
          code: error.code || 'CONFIRMATION_ERROR',
          message: error.message || 'Failed to confirm location',
          details: error.details
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract location from natural language text
   */
  extractLocationFromText(text: string): string[] {
    const locations: string[] = [];
    
    // Apply location patterns
    for (const pattern of this.locationPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        locations.push(...matches.map(match => match.trim()));
      }
    }

    // Remove duplicates and filter out common non-location words
    const uniqueLocations = [...new Set(locations)]
      .filter(loc => this.isValidLocationCandidate(loc));

    logger.debug('Extracted locations from text', {
      text,
      locations: uniqueLocations
    });

    return uniqueLocations;
  }

  /**
   * Get location suggestions based on partial input
   */
  async getLocationSuggestions(
    partial: string,
    limit: number = 5
  ): Promise<WeatherAPIResponse<Location[]>> {
    try {
      const searchResult = await this.searchLocations(partial, {
        maxResults: limit,
        strictMode: false
      });

      if (!searchResult.success) {
        return searchResult as unknown as WeatherAPIResponse<Location[]>;
      }

      const suggestions = [
        searchResult.data!.location,
        ...(searchResult.data!.alternatives || [])
      ].slice(0, limit);

      return {
        success: true,
        data: suggestions,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'SUGGESTION_ERROR',
          message: 'Failed to get location suggestions',
          details: error.message
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Preprocess query to improve geocoding accuracy
   */
  private preprocessQuery(query: string): string {
    // Remove noise words and clean up
    let cleaned = query
      .trim()
      .replace(/[，。！？；：""''（）【】]/g, ' ') // Remove Chinese punctuation
      .replace(/[,!?;:"'()[\]{}]/g, ' ') // Remove English punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Handle common abbreviations and variations
    cleaned = cleaned
      .replace(/\b(NYC|NY)\b/gi, 'New York')
      .replace(/\b(LA|L\.A\.)\b/gi, 'Los Angeles')  
      .replace(/\b(SF|S\.F\.)\b/gi, 'San Francisco')
      .replace(/台灣/g, 'Taiwan')
      .replace(/日本/g, 'Japan')
      .replace(/中國/g, 'China')
      .replace(/美國/g, 'United States');

    return cleaned;
  }

  /**
   * Rank geocoding results by relevance and quality
   */
  private rankLocationResults(
    results: GeocodingResult[],
    query: string,
    options: LocationSearchOptions
  ): GeocodingResult[] {
    return results
      .map(result => ({
        ...result,
        relevanceScore: this.calculateRelevanceScore(result, query, options)
      }))
      .sort((a, b) => (b as any).relevanceScore - (a as any).relevanceScore)
      .slice(0, options.maxResults || 5);
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(
    result: GeocodingResult,
    query: string,
    options: LocationSearchOptions
  ): number {
    let score = result.confidence;

    // Boost score for exact matches
    if (result.formattedAddress.toLowerCase().includes(query.toLowerCase())) {
      score += 0.2;
    }

    // Boost score for country bias
    if (options.countryBias) {
      const country = result.location.country?.toLowerCase();
      if (country === options.countryBias.toLowerCase()) {
        score += 0.15;
      }
    }

    // Penalize very generic results
    const isGeneric = result.formattedAddress.split(',').length < 2;
    if (isGeneric) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Build location confirmation object
   */
  private buildLocationConfirmation(
    results: GeocodingResult[],
    options: LocationSearchOptions
  ): LocationConfirmation {
    const primary = results[0];
    const alternatives = results.slice(1, 3).map(r => r.location);
    
    let source: 'exact' | 'fuzzy' | 'suggestion' = 'fuzzy';
    if (primary.confidence > 0.9) source = 'exact';
    if (primary.confidence < 0.6) source = 'suggestion';

    const needsConfirmation = 
      options.strictMode === true ||
      primary.confidence < 0.8 ||
      (results.length > 1 && results[1].confidence > 0.7);

    return {
      location: primary.location,
      confidence: primary.confidence,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      source,
      needsConfirmation
    };
  }

  /**
   * Check if a string is a valid location candidate
   */
  private isValidLocationCandidate(candidate: string): boolean {
    // Filter out common non-location words
    const nonLocationWords = [
      '天氣', '預報', '溫度', '濕度', '風速', '氣壓',
      'weather', 'forecast', 'temperature', 'humidity', 'wind', 'pressure',
      '今天', '明天', '昨天', '週末', 'today', 'tomorrow', 'yesterday', 'weekend',
      '早上', '下午', '晚上', 'morning', 'afternoon', 'evening', 'night'
    ];

    return (
      candidate.length >= 2 &&
      !nonLocationWords.some(word => candidate.toLowerCase().includes(word.toLowerCase()))
    );
  }

  /**
   * Calculate center point of bounds
   */
  private calculateCenter(bounds: NonNullable<LocationSearchOptions['bounds']>): { lat: number; lng: number } {
    return {
      lat: (bounds.northeast.lat + bounds.southwest.lat) / 2,
      lng: (bounds.northeast.lng + bounds.southwest.lng) / 2
    };
  }

  /**
   * Calculate radius from bounds
   */
  private calculateRadius(bounds: NonNullable<LocationSearchOptions['bounds']>): number {
    const latDiff = Math.abs(bounds.northeast.lat - bounds.southwest.lat);
    const lngDiff = Math.abs(bounds.northeast.lng - bounds.southwest.lng);
    
    // Convert to approximate kilometers (rough calculation)
    const kmPerDegree = 111.32;
    const avgDiff = (latDiff + lngDiff) / 2;
    
    return Math.max(1000, avgDiff * kmPerDegree * 1000); // minimum 1km
  }

  /**
   * Get service capabilities
   */
  getCapabilities(): object {
    return {
      search: {
        fuzzyMatching: true,
        multipleResults: true,
        confidenceScoring: true,
        languageSupport: ['en', 'zh-TW', 'ja']
      },
      confirmation: {
        reverseGeocoding: true,
        coordinateValidation: true
      },
      extraction: {
        naturalLanguage: true,
        patternMatching: true,
        multipleLocations: true
      }
    };
  }

  /**
   * Health check for location service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testResult = await this.searchLocations('New York', {
        maxResults: 1,
        language: 'en'
      });
      return testResult.success;
    } catch (error) {
      logger.error('Location service health check failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }
}