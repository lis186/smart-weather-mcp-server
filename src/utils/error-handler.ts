/**
 * Error Handler Utilities for Smart Weather MCP Server
 * Provides comprehensive error handling with user-friendly messages and recovery strategies
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { RoutingError } from '../types/routing.js';
import { logger } from '../services/logger.js';

export interface ErrorContext {
  /** Original user query */
  query?: string;
  /** API endpoint involved */
  apiEndpoint?: string;
  /** Location information */
  location?: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

export interface UserFriendlyError {
  /** User-facing error message */
  message: string;
  /** Suggested actions for the user */
  suggestions: string[];
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Error severity level */
  severity: 'low' | 'medium' | 'high';
  /** Internal error code for debugging */
  code: string;
}

export class WeatherErrorHandler {
  
  /**
   * Convert various error types to user-friendly format
   */
  static handleError(error: unknown, context?: ErrorContext): UserFriendlyError {
    // Handle MCP errors
    if (error instanceof McpError) {
      return this.handleMCPError(error, context);
    }

    // Handle routing errors
    if (this.isRoutingError(error)) {
      return this.handleRoutingError(error as RoutingError, context);
    }

    // Handle API errors
    if (this.isAPIError(error)) {
      return this.handleAPIError(error, context);
    }

    // Handle validation errors
    if (this.isValidationError(error)) {
      return this.handleValidationError(error, context);
    }

    // Handle network errors
    if (this.isNetworkError(error)) {
      return this.handleNetworkError(error, context);
    }

    // Handle generic errors
    return this.handleGenericError(error, context);
  }

  /**
   * Handle MCP-specific errors
   */
  private static handleMCPError(error: McpError, context?: ErrorContext): UserFriendlyError {
    switch (error.code) {
      case ErrorCode.InvalidParams:
        return {
          message: "I couldn't understand your weather request. Could you please rephrase it?",
          suggestions: [
            "Try specifying a location: 'What's the weather in Tokyo?'",
            "Be more specific about timing: 'Will it rain tomorrow?'",
            "Include the type of information you want: 'temperature forecast for this week'"
          ],
          retryable: true,
          severity: 'low',
          code: 'INVALID_PARAMS'
        };

      case ErrorCode.MethodNotFound:
        return {
          message: "I don't recognize that weather request type.",
          suggestions: [
            "Try asking for current weather, forecasts, or location searches",
            "Use simpler language in your request",
            "Check if you're using a supported weather query format"
          ],
          retryable: false,
          severity: 'medium',
          code: 'UNSUPPORTED_REQUEST'
        };

      case ErrorCode.InternalError:
        return {
          message: "I'm experiencing technical difficulties while processing your weather request.",
          suggestions: [
            "Please try your request again in a moment",
            "If the problem persists, try simplifying your query",
            "Contact support if you continue to have issues"
          ],
          retryable: true,
          severity: 'high',
          code: 'INTERNAL_ERROR'
        };

      default:
        return {
          message: "An unexpected error occurred while processing your weather request.",
          suggestions: [
            "Please try your request again",
            "Try rephrasing your query",
            "Contact support if the issue continues"
          ],
          retryable: true,
          severity: 'medium',
          code: 'MCP_ERROR'
        };
    }
  }

  /**
   * Handle routing-specific errors
   */
  private static handleRoutingError(error: RoutingError, context?: ErrorContext): UserFriendlyError {
    // Use the error message from the RoutingError object
    return {
      message: error.message || 'An error occurred while processing your weather request',
      suggestions: error.suggestions || [
        "Try rephrasing your query",
        "Be more specific about the location",
        "Check your internet connection"
      ],
      retryable: true,
      severity: 'medium',
      code: error.code
    };
  }

  /**
   * Handle API-specific errors
   */
  private static handleAPIError(error: any, context?: ErrorContext): UserFriendlyError {
    const status = error.status || error.statusCode || 0;
    const message = error.message || error.error_message || 'Unknown API error';

    // Google API specific errors
    if (error.error?.code || message.includes('GOOGLE_API')) {
      return this.handleGoogleAPIError(error, context);
    }

    // HTTP status code handling
    switch (status) {
      case 400:
        return {
          message: "Your weather request contains invalid parameters.",
          suggestions: [
            "Check that your location name is spelled correctly",
            "Ensure your request is formatted properly",
            "Try simplifying your query"
          ],
          retryable: true,
          severity: 'low',
          code: 'INVALID_REQUEST'
        };

      case 401:
        return {
          message: "I'm having authentication issues with the weather service.",
          suggestions: [
            "This is likely a temporary issue - please try again",
            "Contact support if the problem persists"
          ],
          retryable: true,
          severity: 'high',
          code: 'AUTH_ERROR'
        };

      case 403:
        return {
          message: "I don't have permission to access weather data for this request.",
          suggestions: [
            "Try asking for a different location",
            "This might be a temporary restriction",
            "Contact support for assistance"
          ],
          retryable: false,
          severity: 'medium',
          code: 'FORBIDDEN'
        };

      case 404:
        return {
          message: `Weather data not found for "${context?.location || 'the requested location'}".`,
          suggestions: [
            "Check the spelling of the location name",
            "Try a nearby major city",
            "Use a more specific location name"
          ],
          retryable: true,
          severity: 'low',
          code: 'DATA_NOT_FOUND'
        };

      case 429:
        return {
          message: "I'm making too many requests to the weather service. Please wait a moment.",
          suggestions: [
            "Wait a few minutes before trying again",
            "Try combining multiple questions into one request"
          ],
          retryable: true,
          severity: 'medium',
          code: 'RATE_LIMITED'
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          message: "The weather service is temporarily experiencing issues.",
          suggestions: [
            "Please try again in a few minutes",
            "The service should be back online shortly",
            "Contact support if issues persist"
          ],
          retryable: true,
          severity: 'high',
          code: 'SERVICE_ERROR'
        };

      default:
        return {
          message: "I encountered an issue while fetching weather data.",
          suggestions: [
            "Please try your request again",
            "Try asking for different weather information",
            "Contact support if problems continue"
          ],
          retryable: true,
          severity: 'medium',
          code: 'API_ERROR'
        };
    }
  }

  /**
   * Handle Google API specific errors
   */
  private static handleGoogleAPIError(error: any, context?: ErrorContext): UserFriendlyError {
    const code = error.error?.code || error.code;
    const message = error.error?.message || error.message;

    switch (code) {
      case 'ZERO_RESULTS':
        return {
          message: `No weather data available for "${context?.location || 'that location'}".`,
          suggestions: [
            "Try a different location name",
            "Check if the location name is spelled correctly",
            "Use a nearby major city instead"
          ],
          retryable: true,
          severity: 'low',
          code: 'NO_RESULTS'
        };

      case 'INVALID_REQUEST':
        return {
          message: "Your weather request has invalid parameters.",
          suggestions: [
            "Try rephrasing your request",
            "Check that location names are spelled correctly",
            "Simplify your query"
          ],
          retryable: true,
          severity: 'low',
          code: 'INVALID_REQUEST'
        };

      case 'OVER_QUERY_LIMIT':
        return {
          message: "I've reached the limit for weather service requests. Please try again later.",
          suggestions: [
            "Wait a few minutes before making another request",
            "Try again during off-peak hours"
          ],
          retryable: true,
          severity: 'high',
          code: 'QUOTA_EXCEEDED'
        };

      case 'REQUEST_DENIED':
        return {
          message: "The weather service denied this request.",
          suggestions: [
            "This might be a temporary issue - try again",
            "Contact support if the problem persists"
          ],
          retryable: true,
          severity: 'medium',
          code: 'REQUEST_DENIED'
        };

      default:
        return {
          message: "I encountered an issue with the Google weather service.",
          suggestions: [
            "Please try your request again",
            "Try a different location if applicable",
            "Contact support if issues persist"
          ],
          retryable: true,
          severity: 'medium',
          code: 'GOOGLE_API_ERROR'
        };
    }
  }

  /**
   * Handle validation errors
   */
  private static handleValidationError(error: any, context?: ErrorContext): UserFriendlyError {
    return {
      message: "Your weather request has some issues that need to be fixed.",
      suggestions: [
        "Make sure to include a location in your request",
        "Check that dates and times are in a valid format",
        "Ensure your request is not too long or complex"
      ],
      retryable: true,
      severity: 'low',
      code: 'VALIDATION_ERROR'
    };
  }

  /**
   * Handle network errors
   */
  private static handleNetworkError(error: any, context?: ErrorContext): UserFriendlyError {
    return {
      message: "I'm having trouble connecting to the weather service.",
      suggestions: [
        "Please check your internet connection",
        "Try your request again in a moment",
        "The service might be temporarily unavailable"
      ],
      retryable: true,
      severity: 'high',
      code: 'NETWORK_ERROR'
    };
  }

  /**
   * Handle generic errors
   */
  private static handleGenericError(error: unknown, context?: ErrorContext): UserFriendlyError {
    const message = error instanceof Error ? error.message : String(error);
    
    logger.error('Unhandled error in weather service', { 
      error: message,
      context 
    });

    return {
      message: "I encountered an unexpected issue while processing your weather request.",
      suggestions: [
        "Please try your request again",
        "Try simplifying your query",
        "Contact support if the problem continues"
      ],
      retryable: true,
      severity: 'medium',
      code: 'UNKNOWN_ERROR'
    };
  }

  /**
   * Type guards for error detection
   */
  private static isRoutingError(error: any): boolean {
    return error && typeof error === 'object' && 
           'code' in error && 
           'message' in error && 
           ['PARSING_FAILED', 'NO_SUITABLE_API', 'INVALID_QUERY', 'TIMEOUT', 'UNKNOWN'].includes(error.code);
  }

  private static isAPIError(error: any): boolean {
    return error && (
      typeof error.status === 'number' ||
      typeof error.statusCode === 'number' ||
      error.error?.code ||
      error.response?.status
    );
  }

  private static isValidationError(error: any): boolean {
    return error && (
      error.name === 'ValidationError' ||
      (error.message && error.message.includes('validation'))
    );
  }

  private static isNetworkError(error: any): boolean {
    return error && (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.name === 'NetworkError' ||
      (error.message && error.message.includes('network'))
    );
  }

  /**
   * Create MCP error from user-friendly error
   */
  static toMCPError(userError: UserFriendlyError, context?: ErrorContext): McpError {
    let errorCode: ErrorCode;

    switch (userError.code) {
      case 'INVALID_PARAMS':
      case 'INVALID_REQUEST':
      case 'VALIDATION_ERROR':
        errorCode = ErrorCode.InvalidParams;
        break;
      case 'UNSUPPORTED_REQUEST':
        errorCode = ErrorCode.MethodNotFound;
        break;
      case 'INTERNAL_ERROR':
      case 'SERVICE_ERROR':
      case 'UNKNOWN_ERROR':
        errorCode = ErrorCode.InternalError;
        break;
      default:
        errorCode = ErrorCode.InternalError;
    }

    return new McpError(errorCode, userError.message);
  }

  /**
   * Format error for user display
   */
  static formatForUser(userError: UserFriendlyError): string {
    let formatted = userError.message;

    if (userError.suggestions.length > 0) {
      formatted += '\n\nSuggestions:';
      userError.suggestions.forEach((suggestion, index) => {
        formatted += `\n${index + 1}. ${suggestion}`;
      });
    }

    if (userError.retryable) {
      formatted += '\n\nYou can try this request again.';
    }

    return formatted;
  }

  /**
   * Log error with appropriate level
   */
  static logError(userError: UserFriendlyError, originalError: unknown, context?: ErrorContext): void {
    const logData = {
      code: userError.code,
      severity: userError.severity,
      retryable: userError.retryable,
      context,
      originalError: originalError instanceof Error ? originalError.message : String(originalError)
    };

    switch (userError.severity) {
      case 'low':
        logger.info('Weather service error (low severity)', logData);
        break;
      case 'medium':
        logger.warn('Weather service error (medium severity)', logData);
        break;
      case 'high':
        logger.error('Weather service error (high severity)', logData);
        break;
    }
  }
}