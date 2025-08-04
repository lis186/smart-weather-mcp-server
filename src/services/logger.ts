/**
 * Structured logging service for Smart Weather MCP Server
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    // Set log level based on environment
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    switch (envLevel) {
      case 'error':
        this.logLevel = LogLevel.ERROR;
        break;
      case 'warn':
        this.logLevel = LogLevel.WARN;
        break;
      case 'debug':
        this.logLevel = LogLevel.DEBUG;
        break;
      default:
        this.logLevel = LogLevel.INFO;
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex <= currentLevelIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const baseLog = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      return `${baseLog} | Context: ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error) {
      return `${baseLog} | Error: ${entry.error.message} | Stack: ${entry.error.stack}`;
    }
    
    return baseLog;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error
    };

    const formattedLog = this.formatLogEntry(entry);

    // Output to appropriate stream
    if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      console.error(formattedLog);
    } else {
      console.log(formattedLog);
    }
  }

  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Convenience methods for common logging patterns
  serverStarted(host: string, port: number, environment: string): void {
    this.info('Server started successfully', {
      host,
      port,
      environment,
      endpoints: {
        health: `http://${host}:${port}/health`,
        sse: `http://${host}:${port}/sse`
      }
    });
  }

  sseConnectionEstablished(connectionId: string, activeConnections: number): void {
    this.info('SSE connection established', {
      connectionId,
      activeConnections
    });
  }

  sseConnectionClosed(connectionId: string, activeConnections: number): void {
    this.info('SSE connection closed', {
      connectionId,
      activeConnections
    });
  }

  connectionCleanup(connectionId: string, reason: string): void {
    this.debug('Connection cleanup', {
      connectionId,
      reason
    });
  }

  toolCall(toolName: string, query: string, context?: Record<string, unknown>): void {
    this.info('Tool call executed', {
      toolName,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      hasContext: !!context
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();