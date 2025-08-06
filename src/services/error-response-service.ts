/**
 * Error Response Service for Smart Weather MCP Server
 * Provides user-friendly error messages and suggestions
 */

import { logger } from './logger.js';
import type { WeatherAPIResponse, WeatherAPIError } from '../types/weather-api.js';

export interface FriendlyErrorResponse {
  code: string;
  message: string;
  suggestion: string;
  retryable: boolean;
  retryAfter?: number;
}

export class ErrorResponseService {
  /**
   * Convert technical errors to user-friendly responses
   */
  static createFriendlyError(
    error: WeatherAPIError | Error,
    context?: { query?: string; location?: string; language?: string }
  ): FriendlyErrorResponse {
    const language = context?.language || 'en';
    
    if (this.isWeatherAPIError(error)) {
      return this.handleWeatherAPIError(error, context, language);
    }
    
    return this.handleGenericError(error, context, language);
  }

  /**
   * Create user-friendly error response for weather API responses
   */
  static createErrorResponse<T>(
    error: WeatherAPIError | Error,
    context?: { query?: string; location?: string; language?: string }
  ): WeatherAPIResponse<T> {
    const friendlyError = this.createFriendlyError(error, context);
    
    return {
      success: false,
      error: {
        code: friendlyError.code,
        message: friendlyError.message,
        details: friendlyError.suggestion
      }
    };
  }

  private static isWeatherAPIError(error: any): error is WeatherAPIError {
    return error && typeof error.code === 'string' && typeof error.message === 'string';
  }

  private static handleWeatherAPIError(
    error: WeatherAPIError,
    context?: { query?: string; location?: string; language?: string },
    language: string = 'en'
  ): FriendlyErrorResponse {
    const messages = this.getErrorMessages(language);
    
    switch (error.code) {
      case 'INVALID_LOCATION':
        return {
          code: 'LOCATION_NOT_FOUND',
          message: messages.locationNotFound,
          suggestion: context?.query 
            ? messages.locationSuggestion.replace('{query}', context.query)
            : messages.locationSuggestionGeneric,
          retryable: true
        };

      case 'INVALID_API_KEY':
        return {
          code: 'SERVICE_UNAVAILABLE',
          message: messages.serviceUnavailable,
          suggestion: messages.serviceSuggestion,
          retryable: true,
          retryAfter: 300 // 5 minutes
        };

      case 'API_QUOTA_EXCEEDED':
        return {
          code: 'RATE_LIMITED',
          message: messages.rateLimited,
          suggestion: messages.rateLimitSuggestion,
          retryable: true,
          retryAfter: 3600 // 1 hour
        };

      case 'RATE_LIMITED':
        return {
          code: 'TOO_MANY_REQUESTS',
          message: messages.tooManyRequests,
          suggestion: messages.rateLimitSuggestion,
          retryable: true,
          retryAfter: 60 // 1 minute
        };

      case 'SERVER_ERROR':
        return {
          code: 'WEATHER_SERVICE_ERROR',
          message: messages.weatherServiceError,
          suggestion: messages.weatherServiceSuggestion,
          retryable: true,
          retryAfter: 120 // 2 minutes
        };

      case 'NETWORK_ERROR':
        return {
          code: 'CONNECTION_ERROR',
          message: messages.connectionError,
          suggestion: messages.connectionSuggestion,
          retryable: true,
          retryAfter: 30 // 30 seconds
        };

      default:
        return {
          code: 'UNKNOWN_ERROR',
          message: messages.unknownError,
          suggestion: messages.unknownSuggestion,
          retryable: false
        };
    }
  }

  private static handleGenericError(
    error: Error,
    context?: { query?: string; location?: string; language?: string },
    language: string = 'en'
  ): FriendlyErrorResponse {
    const messages = this.getErrorMessages(language);
    
    logger.error('Unexpected error in weather service', {
      error: error.message,
      stack: error.stack,
      context
    });

    if (error.message.includes('timeout')) {
      return {
        code: 'REQUEST_TIMEOUT',
        message: messages.timeout,
        suggestion: messages.timeoutSuggestion,
        retryable: true,
        retryAfter: 30
      };
    }

    if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      return {
        code: 'NETWORK_ERROR',
        message: messages.connectionError,
        suggestion: messages.connectionSuggestion,
        retryable: true,
        retryAfter: 60
      };
    }

    return {
      code: 'SYSTEM_ERROR',
      message: messages.systemError,
      suggestion: messages.systemSuggestion,
      retryable: false
    };
  }

  private static getErrorMessages(language: string): Record<string, string> {
    const messages: Record<string, Record<string, string>> = {
      'en': {
        locationNotFound: 'Sorry, I couldn\'t find weather information for that location.',
        locationSuggestion: 'Please try a more specific location name, like "New York, NY" or "Tokyo, Japan".',
        locationSuggestionGeneric: 'Please try a more specific location name with city and country.',
        serviceUnavailable: 'Weather service is temporarily unavailable.',
        serviceSuggestion: 'Please try again in a few minutes. If the problem persists, the service may be under maintenance.',
        rateLimited: 'Too many weather requests in a short time.',
        rateLimitSuggestion: 'Please wait a moment before making another weather query.',
        tooManyRequests: 'You\'ve made too many requests recently.',
        weatherServiceError: 'Weather service is experiencing technical difficulties.',
        weatherServiceSuggestion: 'Please try again in a few minutes. The service should recover automatically.',
        connectionError: 'Unable to connect to weather service.',
        connectionSuggestion: 'Please check your internet connection and try again.',
        timeout: 'Weather request timed out.',
        timeoutSuggestion: 'The weather service is responding slowly. Please try again.',
        unknownError: 'An unexpected error occurred.',
        unknownSuggestion: 'Please try rephrasing your weather query or try again later.',
        systemError: 'System error occurred while processing your request.',
        systemSuggestion: 'Please try again. If the problem continues, please contact support.'
      },
      'zh-TW': {
        locationNotFound: '抱歉，找不到該地點的天氣資訊。',
        locationSuggestion: '請嘗試更具體的地點名稱，例如「台北市」或「東京，日本」。',
        locationSuggestionGeneric: '請嘗試更具體的地點名稱，包含城市和國家。',
        serviceUnavailable: '天氣服務暫時無法使用。',
        serviceSuggestion: '請稍後再試。如果問題持續，服務可能正在維護中。',
        rateLimited: '短時間內天氣查詢請求過多。',
        rateLimitSuggestion: '請稍等片刻再進行下一次天氣查詢。',
        tooManyRequests: '您最近的請求次數過多。',
        weatherServiceError: '天氣服務遇到技術問題。',
        weatherServiceSuggestion: '請稍後再試。服務應該會自動恢復。',
        connectionError: '無法連接到天氣服務。',
        connectionSuggestion: '請檢查您的網路連接並重試。',
        timeout: '天氣請求超時。',
        timeoutSuggestion: '天氣服務回應較慢。請重試。',
        unknownError: '發生未預期的錯誤。',
        unknownSuggestion: '請嘗試重新描述您的天氣查詢或稍後再試。',
        systemError: '處理您的請求時發生系統錯誤。',
        systemSuggestion: '請重試。如果問題持續，請聯繫客服。'
      }
    };

    return messages[language] || messages['en'];
  }

  /**
   * Log error with appropriate level and context
   */
  static logError(
    error: Error | WeatherAPIError,
    context?: { query?: string; location?: string; userId?: string }
  ): void {
    const errorInfo = {
      message: error.message,
      context,
      timestamp: new Date().toISOString()
    };

    if (this.isWeatherAPIError(error)) {
      switch (error.code) {
        case 'RATE_LIMITED':
        case 'API_QUOTA_EXCEEDED':
          logger.warn('API rate limit reached', errorInfo);
          break;
        case 'INVALID_LOCATION':
          logger.info('Invalid location query', errorInfo);
          break;
        case 'SERVER_ERROR':
        case 'NETWORK_ERROR':
          logger.error('Weather service error', errorInfo);
          break;
        default:
          logger.error('Weather API error', errorInfo);
      }
    } else {
      logger.error('Unexpected error', {
        ...errorInfo,
        stack: error.stack
      });
    }
  }
}
