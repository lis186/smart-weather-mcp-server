export interface WeatherQuery {
    query: string;
    context?: {
        location?: string;
        timeframe?: string;
        preferences?: Record<string, any>;
    };
}
export interface WeatherResponse {
    success: boolean;
    data?: any;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}
export interface ServerConfig {
    port: number;
    host: string;
    environment: 'development' | 'production';
    secrets?: {
        geminiApiKey?: string;
        weatherApiKey?: string;
    };
}
//# sourceMappingURL=index.d.ts.map