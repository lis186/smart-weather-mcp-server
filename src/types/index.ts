export interface WeatherQuery {
  query: string;
  context?: {
    location?: string;
    timeframe?: string;
    preferences?: Record<string, unknown>;
    country?: string;
    region?: string;
    activity?: string;
    [key: string]: unknown;
  };
}

export interface WeatherResponse {
  success: boolean;
  data?: unknown;
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

export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface MCPListToolsResponse {
  tools: MCPToolDefinition[];
}

export interface MCPCallToolRequest {
  params: {
    name: string;
    arguments: unknown;
  };
}