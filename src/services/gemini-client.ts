/**
 * Google Vertex AI Gemini Client for Smart Weather MCP Server
 * Handles natural language parsing using Gemini 2.5 Flash-Lite
 */

import { VertexAI } from '@google-cloud/vertexai';
import { GenerateContentRequest, GenerateContentResponse } from '@google-cloud/vertexai';
import { GeminiConfig, ParsingResult, ParsingError } from '../types/parser.js';
import { logger } from './logger.js';

export class GeminiClient {
  private vertexAI: VertexAI;
  private model: any;
  private readonly config: Required<GeminiConfig>;
  private readonly usageStats = {
    totalRequests: 0,
    totalTokens: 0,
    totalErrors: 0
  };

  constructor(config: GeminiConfig) {
    this.config = {
      projectId: config.projectId,
      region: config.region || 'us-central1',
      model: config.model || 'gemini-2.5-flash-002',
      temperature: config.temperature ?? 0.1,
      maxTokens: config.maxTokens || 1024,
      timeout: config.timeout || 5000
    };

    this.vertexAI = new VertexAI({
      project: this.config.projectId,
      location: this.config.region
    });

    this.model = this.vertexAI.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        temperature: this.config.temperature,
        candidateCount: 1,
        maxOutputTokens: this.config.maxTokens
      }
    });

    logger.info('Gemini client initialized', {
      projectId: this.config.projectId,
      region: this.config.region,
      model: this.config.model
    });
  }

  /**
   * Generate content using Gemini model with timeout control
   */
  async generateContent(prompt: string): Promise<{
    response: string;
    tokensUsed?: number;
  }> {
    const startTime = Date.now();
    this.usageStats.totalRequests++;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), this.config.timeout)
      );

      // Create generation promise
      const generatePromise = this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      });

      // Race between generation and timeout
      const result = await Promise.race([generatePromise, timeoutPromise]);
      
      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('No text content in Gemini response');
      }

      const tokensUsed = response.usageMetadata?.totalTokenCount;
      if (tokensUsed) {
        this.usageStats.totalTokens += tokensUsed;
      }

      const processingTime = Date.now() - startTime;
      logger.debug('Gemini generation successful', {
        processingTime,
        tokensUsed,
        promptLength: prompt.length,
        responseLength: text.length
      });

      return {
        response: text.trim(),
        tokensUsed
      };

    } catch (error) {
      this.usageStats.totalErrors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Gemini generation failed', {
        error: errorMessage,
        processingTime: Date.now() - startTime,
        config: {
          model: this.config.model,
          temperature: this.config.temperature
        }
      });

      throw new Error(`Gemini API error: ${errorMessage}`);
    }
  }

  /**
   * Parse JSON response from Gemini with error handling
   */
  parseStructuredResponse<T>(response: string): T {
    try {
      // Clean response - remove markdown code blocks if present
      const cleanResponse = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

      const parsed = JSON.parse(cleanResponse);
      return parsed as T;
    } catch (error) {
      logger.error('Failed to parse Gemini JSON response', {
        response: response.substring(0, 200),
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Invalid JSON response from Gemini: ${response.substring(0, 100)}...`);
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      ...this.usageStats,
      averageTokensPerRequest: this.usageStats.totalRequests > 0 
        ? Math.round(this.usageStats.totalTokens / this.usageStats.totalRequests)
        : 0,
      errorRate: this.usageStats.totalRequests > 0
        ? Math.round((this.usageStats.totalErrors / this.usageStats.totalRequests) * 100)
        : 0
    };
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.usageStats.totalRequests = 0;
    this.usageStats.totalTokens = 0;
    this.usageStats.totalErrors = 0;
    logger.info('Gemini usage statistics reset');
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<GeminiConfig>): void {
    Object.assign(this.config, updates);
    logger.info('Gemini client configuration updated', { updates });
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<GeminiConfig> {
    return { ...this.config };
  }

  /**
   * Health check - test connection to Gemini API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testPrompt = 'Respond with exactly "OK" if you can understand this message.';
      const result = await this.generateContent(testPrompt);
      return result.response.trim().toUpperCase() === 'OK';
    } catch (error) {
      logger.warn('Gemini health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}