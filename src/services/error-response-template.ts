/**
 * ErrorResponseTemplateService
 * Enterprise-grade configurable error handling system
 * 
 * Provides flexible, templated error responses with:
 * - Dynamic variable interpolation
 * - Multiple error scenarios
 * - Internationalization support
 * - Context-aware suggestions
 */

import type { WeatherAPIResponse } from '../types/weather-api.js';
import type { Location } from '../types/weather-api.js';

export interface ErrorTemplate {
  code: string;
  message: string;
  detailsTemplate: string;
  suggestions: string[];
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface ErrorContext {
  location?: Location;
  service?: string;
  apiName?: string;
  supportedAlternatives?: string[];
  language?: string;
  retryable?: boolean;
}

export interface ErrorTemplateConfig {
  templates: Record<string, ErrorTemplate>;
  defaultLanguage: string;
  locationDisplayFormat: 'name' | 'coordinates' | 'both';
}

export class ErrorResponseTemplateService {
  private static readonly DEFAULT_CONFIG: ErrorTemplateConfig = {
    templates: {
      LOCATION_NOT_SUPPORTED: {
        code: 'LOCATION_NOT_SUPPORTED',
        message: 'Weather information is not available for {location}',
        detailsTemplate: '{details} This location may not be covered by {apiName}. {suggestions}',
        suggestions: [
          'Try a nearby major city',
          'Use latitude/longitude coordinates instead',
          'Check our supported locations list'
        ],
        severity: 'warning'
      },
      SERVICE_UNAVAILABLE: {
        code: 'SERVICE_UNAVAILABLE',
        message: '{service} service is currently unavailable',
        detailsTemplate: '{details} {retryGuidance}',
        suggestions: [
          'Please try again in a few minutes',
          'Check service status page',
          'Contact support if issue persists'
        ],
        severity: 'error'
      },
      API_ACCESS_DENIED: {
        code: 'API_ACCESS_DENIED',
        message: '{apiName} access denied',
        detailsTemplate: 'Authentication failed for {apiName}. {troubleshooting}',
        suggestions: [
          'Verify API credentials are configured',
          'Check API key permissions',
          'Ensure API quota is not exceeded'
        ],
        severity: 'critical'
      },
      INVALID_LOCATION_FORMAT: {
        code: 'INVALID_LOCATION_FORMAT',
        message: 'Invalid location format provided',
        detailsTemplate: '{details} Expected format: {expectedFormat}',
        suggestions: [
          'Use city name format: "Tokyo, Japan"',
          'Use coordinates format: "35.6762, 139.6503"',
          'Include country for disambiguation'
        ],
        severity: 'error'
      },
      RATE_LIMIT_EXCEEDED: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests for {service}',
        detailsTemplate: 'Rate limit exceeded for {apiName}. {retryGuidance}',
        suggestions: [
          'Wait before making additional requests',
          'Consider upgrading API plan',
          'Implement client-side caching'
        ],
        severity: 'warning'
      }
    },
    defaultLanguage: 'en',
    locationDisplayFormat: 'name'
  };

  private config: ErrorTemplateConfig;

  constructor(config?: Partial<ErrorTemplateConfig>) {
    this.config = {
      ...ErrorResponseTemplateService.DEFAULT_CONFIG,
      ...config,
      templates: {
        ...ErrorResponseTemplateService.DEFAULT_CONFIG.templates,
        ...(config?.templates || {})
      }
    };
  }

  /**
   * Create a formatted error response using templates
   */
  createErrorResponse<T>(
    templateKey: string,
    context: ErrorContext,
    additionalDetails?: string
  ): WeatherAPIResponse<T> {
    const template = this.getTemplate(templateKey);
    const variables = this.buildTemplateVariables(context, additionalDetails);
    
    return {
      success: false,
      error: {
        code: template.code,
        message: this.interpolateTemplate(template.message, variables),
        details: this.interpolateTemplate(template.detailsTemplate, variables),
        suggestions: this.formatSuggestions(template.suggestions, context),
        severity: template.severity,
        retryable: context.retryable || false
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create location not supported error with enhanced context
   */
  createLocationNotSupportedError<T>(
    location: Location,
    details: string,
    apiName = 'our weather data provider'
  ): WeatherAPIResponse<T> {
    const context: ErrorContext = {
      location,
      apiName,
      supportedAlternatives: this.getSuggestedAlternatives(location),
      retryable: false
    };

    return this.createErrorResponse('LOCATION_NOT_SUPPORTED', context, details);
  }

  /**
   * Create service unavailable error
   */
  createServiceUnavailableError<T>(
    serviceName: string,
    details: string,
    retryable = true
  ): WeatherAPIResponse<T> {
    const context: ErrorContext = {
      service: serviceName,
      retryable
    };

    return this.createErrorResponse('SERVICE_UNAVAILABLE', context, details);
  }

  /**
   * Create API access denied error
   */
  createAPIAccessDeniedError<T>(
    apiName: string,
    details: string
  ): WeatherAPIResponse<T> {
    const context: ErrorContext = {
      apiName,
      retryable: false
    };

    return this.createErrorResponse('API_ACCESS_DENIED', context, details);
  }

  /**
   * Get template by key with fallback
   */
  private getTemplate(key: string): ErrorTemplate {
    const template = this.config.templates[key];
    if (!template) {
      // Fallback template for unknown error types
      return {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
        detailsTemplate: '{details}',
        suggestions: ['Please try again later', 'Contact support if issue persists'],
        severity: 'error'
      };
    }
    return template;
  }

  /**
   * Build variables for template interpolation
   */
  private buildTemplateVariables(context: ErrorContext, additionalDetails?: string): Record<string, string> {
    const variables: Record<string, string> = {
      details: additionalDetails || '',
      service: context.service || 'Weather service',
      apiName: context.apiName || 'Weather API',
      language: context.language || this.config.defaultLanguage
    };

    // Add location display
    if (context.location) {
      variables.location = this.formatLocationDisplay(context.location);
    }

    // Add contextual guidance
    variables.suggestions = this.formatContextualSuggestions(context);
    variables.retryGuidance = context.retryable ? 
      'You can try again in a few minutes.' : 
      'This issue requires manual resolution.';
    
    variables.troubleshooting = this.buildTroubleshootingGuidance(context);
    variables.expectedFormat = this.getExpectedLocationFormat();

    return variables;
  }

  /**
   * Interpolate template with variables
   */
  private interpolateTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Format location for display
   */
  private formatLocationDisplay(location: Location): string {
    switch (this.config.locationDisplayFormat) {
      case 'name':
        return location.name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
      case 'coordinates':
        return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
      case 'both':
        return location.name ? 
          `${location.name} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})` :
          `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
      default:
        return location.name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    }
  }

  /**
   * Format suggestions based on context
   */
  private formatSuggestions(baseSuggestions: string[], context: ErrorContext): string[] {
    const suggestions = [...baseSuggestions];

    // Add location-specific suggestions
    if (context.location && context.supportedAlternatives?.length) {
      suggestions.unshift(`Try nearby supported cities: ${context.supportedAlternatives.join(', ')}`);
    }

    return suggestions;
  }

  /**
   * Get suggested alternative locations
   */
  private getSuggestedAlternatives(location: Location): string[] {
    // Enhanced logic to suggest nearby major cities based on location
    const suggestions: string[] = [];
    
    // Basic regional suggestions (can be enhanced with a proper geographic database)
    if (location.country === 'Japan' || (location.latitude > 30 && location.latitude < 46 && location.longitude > 129 && location.longitude < 146)) {
      suggestions.push('Tokyo', 'Osaka');
    } else if (location.country === 'USA' || (location.latitude > 24 && location.latitude < 49 && location.longitude > -125 && location.longitude < -66)) {
      suggestions.push('New York', 'Los Angeles', 'Chicago');
    } else if (location.country === 'UK' || (location.latitude > 49 && location.latitude < 61 && location.longitude > -8 && location.longitude < 2)) {
      suggestions.push('London', 'Manchester');
    } else if (location.latitude > -44 && location.latitude < -10 && location.longitude > 113 && location.longitude < 154) {
      suggestions.push('Sydney', 'Melbourne');
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Format contextual suggestions
   */
  private formatContextualSuggestions(context: ErrorContext): string {
    if (context.supportedAlternatives?.length) {
      return `Consider trying: ${context.supportedAlternatives.join(', ')}.`;
    }
    return 'Please try a different location or contact support.';
  }

  /**
   * Build troubleshooting guidance
   */
  private buildTroubleshootingGuidance(context: ErrorContext): string {
    const guidance = [];
    
    if (context.apiName) {
      guidance.push(`Verify ${context.apiName} configuration`);
    }
    
    guidance.push('Check service status and try again');
    
    return guidance.join('. ') + '.';
  }

  /**
   * Get expected location format description
   */
  private getExpectedLocationFormat(): string {
    return '"City, Country" or "latitude, longitude"';
  }

  /**
   * Add or update error template
   */
  updateTemplate(key: string, template: ErrorTemplate): void {
    this.config.templates[key] = template;
  }

  /**
   * Get all available template keys
   */
  getAvailableTemplates(): string[] {
    return Object.keys(this.config.templates);
  }

  /**
   * Validate template configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    Object.entries(this.config.templates).forEach(([key, template]) => {
      if (!template.code) {
        errors.push(`Template ${key} missing required field: code`);
      }
      if (!template.message) {
        errors.push(`Template ${key} missing required field: message`);
      }
      if (!template.detailsTemplate) {
        errors.push(`Template ${key} missing required field: detailsTemplate`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance with default configuration
export const errorResponseTemplateService = new ErrorResponseTemplateService();