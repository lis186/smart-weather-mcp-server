/**
 * Types for the Intelligent Query Service
 * Supports AI-powered query understanding and location resolution
 */

import type { Location } from './weather-api.js';

export interface QueryComplexity {
  level: 'simple' | 'moderate' | 'complex';
  confidence: number;
  reasoning: string[];
}

export interface QueryIntent {
  type: 'current_weather' | 'forecast' | 'historical' | 'advice';
  timeframe?: string;
  confidence: number;
  subtype?: string;
}

export interface QueryContext {
  activity?: string;
  preferences?: string[];
  temporalRef?: string;
  comparisons?: string[];
  constraints?: string[];
}

export interface QueryAnalysis {
  /** Original query text */
  originalQuery: string;
  
  /** Query complexity classification */
  complexity: 'simple' | 'moderate' | 'complex';
  
  /** Confidence in the analysis (0-1) */
  confidence: number;
  
  /** Resolved location information */
  location: Location | null;
  
  /** Query intent classification */
  intent: QueryIntent;
  
  /** Language detected */
  language: string;
  
  /** Processing method used */
  method: 'direct_geocoding' | 'ai_parsing' | 'hybrid';
  
  /** Additional context extracted */
  context: QueryContext;
  
  /** Processing metadata */
  metadata?: {
    processingTime?: number;
    fallbackUsed?: boolean;
    confidenceBreakdown?: Record<string, number>;
  };
}

export interface IntelligentQueryConfig {
  /** Enable AI parsing for complex queries */
  enableAIParsing: boolean;
  
  /** Confidence threshold for direct geocoding */
  directGeocodingThreshold: number;
  
  /** Confidence threshold for AI parsing */
  aiParsingThreshold: number;
  
  /** Maximum processing time for query analysis */
  maxProcessingTime: number;
  
  /** Language detection settings */
  languageDetection: {
    enabled: boolean;
    fallbackLanguage: string;
  };
  
  /** Geocoding settings */
  geocoding: {
    maxResults: number;
    strictMode: boolean;
  };
}

export type QueryProcessingMethod = 'direct_geocoding' | 'ai_parsing' | 'hybrid';

export type SupportedLanguage = 
  | 'en' // English
  | 'zh' // Chinese (Simplified/Traditional)
  | 'ja' // Japanese  
  | 'ko' // Korean
  | 'ar' // Arabic
  | 'hi' // Hindi
  | 'fr' // French
  | 'de' // German
  | 'es' // Spanish
  | 'pt' // Portuguese
  | 'it' // Italian
  | 'ru' // Russian
  | 'unknown';

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
  alternatives?: Array<{
    language: SupportedLanguage;
    confidence: number;
  }>;
}

export interface LocationExtractionResult {
  candidates: Array<{
    text: string;
    confidence: number;
    method: 'pattern_match' | 'ai_extraction' | 'geocoding';
  }>;
  bestCandidate?: {
    text: string;
    confidence: number;
    location?: Location;
  };
}