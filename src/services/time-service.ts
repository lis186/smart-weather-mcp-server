/**
 * Time Service for Smart Weather MCP Server
 * Handles relative time processing and timezone conversion
 * Integrates with MCP time service for consistent time handling
 */

export interface TimeContext {
  currentTime: Date;
  timezone: string;
  relativeTime?: string;
}

export interface ParsedTimeInfo {
  absoluteTime: Date;
  relativeDescription: string;
  timezone: string;
  confidence: number;
}

export class TimeService {
  private readonly defaultTimezone: string;

  constructor(defaultTimezone: string = 'Asia/Taipei') {
    this.defaultTimezone = defaultTimezone;
  }

  /**
   * Get current time in specified timezone
   */
  async getCurrentTime(timezone?: string): Promise<Date> {
    // In a real implementation, we would use MCP time service
    // For now, use system time with timezone adjustment
    const tz = timezone || this.defaultTimezone;
    
    try {
      // This would be replaced with actual MCP time service call
      return new Date();
    } catch (error) {
      // Fallback to system time
      return new Date();
    }
  }

  /**
   * Parse relative time expressions in multiple languages
   */
  parseRelativeTime(timeExpression: string, currentTime?: Date): ParsedTimeInfo {
    const now = currentTime || new Date();
    const lowerExpr = timeExpression.toLowerCase().trim();

    // English patterns
    if (lowerExpr.includes('today') || lowerExpr.includes('now')) {
      return {
        absoluteTime: now,
        relativeDescription: 'today',
        timezone: this.defaultTimezone,
        confidence: 0.9
      };
    }

    if (lowerExpr.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        absoluteTime: tomorrow,
        relativeDescription: 'tomorrow',
        timezone: this.defaultTimezone,
        confidence: 0.9
      };
    }

    if (lowerExpr.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        absoluteTime: yesterday,
        relativeDescription: 'yesterday',
        timezone: this.defaultTimezone,
        confidence: 0.9
      };
    }

    // Chinese patterns
    if (lowerExpr.includes('今天') || lowerExpr.includes('今日')) {
      return {
        absoluteTime: now,
        relativeDescription: '今天',
        timezone: this.defaultTimezone,
        confidence: 0.9
      };
    }

    if (lowerExpr.includes('明天')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        absoluteTime: tomorrow,
        relativeDescription: '明天',
        timezone: this.defaultTimezone,
        confidence: 0.9
      };
    }

    if (lowerExpr.includes('昨天')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        absoluteTime: yesterday,
        relativeDescription: '昨天',
        timezone: this.defaultTimezone,
        confidence: 0.9
      };
    }

    // Japanese patterns
    if (lowerExpr.includes('今日') || lowerExpr.includes('きょう')) {
      return {
        absoluteTime: now,
        relativeDescription: '今日',
        timezone: this.defaultTimezone,
        confidence: 0.9
      };
    }

    if (lowerExpr.includes('明日') || lowerExpr.includes('あした')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        absoluteTime: tomorrow,
        relativeDescription: '明日',
        timezone: this.defaultTimezone,
        confidence: 0.9
      };
    }

    // Week patterns
    if (lowerExpr.includes('next week') || lowerExpr.includes('來週') || lowerExpr.includes('下週')) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return {
        absoluteTime: nextWeek,
        relativeDescription: 'next week',
        timezone: this.defaultTimezone,
        confidence: 0.8
      };
    }

    // Default fallback
    return {
      absoluteTime: now,
      relativeDescription: 'current time',
      timezone: this.defaultTimezone,
      confidence: 0.3
    };
  }

  /**
   * Create time context for weather queries
   */
  async createTimeContext(query: string, userTimezone?: string): Promise<TimeContext> {
    const timezone = userTimezone || this.defaultTimezone;
    const currentTime = await this.getCurrentTime(timezone);
    const timeInfo = this.parseRelativeTime(query, currentTime);

    return {
      currentTime: timeInfo.absoluteTime,
      timezone,
      relativeTime: timeInfo.relativeDescription
    };
  }

  /**
   * Format time for display in different languages
   */
  formatTime(date: Date, language: string = 'en'): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };

    switch (language) {
      case 'zh-TW':
      case 'zh-CN':
        return date.toLocaleDateString('zh-TW', options);
      case 'ja':
        return date.toLocaleDateString('ja-JP', options);
      default:
        return date.toLocaleDateString('en-US', options);
    }
  }

  /**
   * Convert time between timezones
   */
  convertTimezone(date: Date, fromTimezone: string, toTimezone: string): Date {
    // In a real implementation, this would use proper timezone conversion
    // For now, return the same date (simplified)
    return date;
  }
}

export const timeService = new TimeService();


