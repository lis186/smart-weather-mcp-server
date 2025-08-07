/**
 * Gemini Weather Advisor Service
 * Provides AI-generated actionable weather advice based on weather data and user context
 * Phase 4.2: Enhanced weather advice with Gemini AI integration
 */

import { GeminiClient } from './gemini-client.js';
import { logger } from './logger.js';
import type { WeatherQueryResult } from './weather-service.js';

export interface WeatherAdviceRequest {
  query: string;
  context?: string;
  weatherData?: WeatherQueryResult;
  language?: string;
}

export interface WeatherAdviceResponse {
  success: boolean;
  advice?: {
    summary: string;
    recommendations: Array<{
      category: string;
      icon: string;
      advice: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    warnings?: Array<{
      type: string;
      message: string;
      severity: 'info' | 'warning' | 'critical';
    }>;
  };
  error?: {
    message: string;
    code?: string;
  };
  source: 'gemini_ai' | 'rule_based' | 'hybrid';
}

export class GeminiWeatherAdvisor {
  private geminiClient: GeminiClient;
  private readonly defaultModel = 'gemini-2.0-flash-exp';

  constructor(geminiClient: GeminiClient) {
    this.geminiClient = geminiClient;
  }

  /**
   * Generate weather advice using Gemini AI
   */
  async generateAdvice(request: WeatherAdviceRequest): Promise<WeatherAdviceResponse> {
    try {
      logger.info('Generating weather advice', {
        query: request.query,
        hasWeatherData: !!request.weatherData,
        language: request.language
      });

      // Try Gemini AI first
      if (this.geminiClient) {
        const aiResponse = await this.generateAIAdvice(request);
        if (aiResponse.success) {
          return { ...aiResponse, source: 'gemini_ai' };
        }
        logger.warn('Gemini AI advice generation failed, falling back to rules');
      }

      // Fallback to rule-based advice
      const ruleResponse = this.generateRuleBasedAdvice(request);
      return { ...ruleResponse, source: 'rule_based' };

    } catch (error) {
      logger.error('Weather advice generation failed', {
        query: request.query,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'ADVICE_GENERATION_ERROR'
        },
        source: 'rule_based'
      };
    }
  }

  /**
   * Generate AI-powered advice using Gemini
   */
  private async generateAIAdvice(request: WeatherAdviceRequest): Promise<WeatherAdviceResponse> {
    const prompt = this.buildAdvicePrompt(request);
    
    try {
      const response = await this.geminiClient.generateContent(prompt);

      if (!response.response) {
        return {
          success: false,
          error: { message: 'Failed to generate AI advice' },
          source: 'gemini_ai'
        };
      }

      // Parse the structured response
      const advice = this.parseAIResponse(response.response);
      
      return {
        success: true,
        advice,
        source: 'gemini_ai'
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'AI generation failed'
        },
        source: 'gemini_ai'
      };
    }
  }

  /**
   * Generate rule-based fallback advice
   */
  private generateRuleBasedAdvice(request: WeatherAdviceRequest): WeatherAdviceResponse {
    const recommendations: Array<{
      category: string;
      icon: string;
      advice: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    const warnings: Array<{
      type: string;
      message: string;
      severity: 'info' | 'warning' | 'critical';
    }> = [];

    // Language detection for response
    const isChineseQuery = /[\u4e00-\u9fa5]/.test(request.query);
    const lang = request.language || (isChineseQuery ? 'zh' : 'en');

    if (request.weatherData?.current) {
      const current = request.weatherData.current;
      const temp = this.getTemperatureValue(current.temperature);

      // Temperature advice
      if (temp > 30) {
        recommendations.push({
          category: lang === 'zh' ? '穿著建議' : 'Clothing',
          icon: '🌡️',
          advice: lang === 'zh' ? '建議穿著輕薄透氣的衣物，避免長時間戶外活動' : 'Wear light, breathable clothing. Avoid prolonged outdoor activities.',
          priority: 'high'
        });
        
        warnings.push({
          type: 'heat',
          message: lang === 'zh' ? '高溫警示：注意防暑降溫' : 'Heat Warning: Take precautions against heat exhaustion',
          severity: 'warning'
        });
      } else if (temp < 5) {
        recommendations.push({
          category: lang === 'zh' ? '穿著建議' : 'Clothing',
          icon: '🧥',
          advice: lang === 'zh' ? '建議穿著保暖外套，注意防風保溫' : 'Wear warm layers and windproof clothing.',
          priority: 'high'
        });
      } else if (temp < 15) {
        recommendations.push({
          category: lang === 'zh' ? '穿著建議' : 'Clothing',
          icon: '👕',
          advice: lang === 'zh' ? '建議穿著長袖衣物，可攜帶薄外套' : 'Wear long sleeves, consider bringing a light jacket.',
          priority: 'medium'
        });
      }

      // Humidity advice
      if (current.humidity > 80) {
        recommendations.push({
          category: lang === 'zh' ? '舒適度' : 'Comfort',
          icon: '💧',
          advice: lang === 'zh' ? '濕度較高，建議選擇透氣材質的衣物' : 'High humidity - choose breathable fabrics.',
          priority: 'medium'
        });
      }

      // Wind advice
      if (current.windSpeed.kilometersPerHour > 25) {
        recommendations.push({
          category: lang === 'zh' ? '戶外活動' : 'Outdoor Activities',
          icon: '💨',
          advice: lang === 'zh' ? '風速較強，戶外活動請注意安全' : 'Strong winds - be cautious with outdoor activities.',
          priority: 'medium'
        });
      }

      // UV advice
      if (current.uvIndex !== undefined && current.uvIndex > 6) {
        recommendations.push({
          category: lang === 'zh' ? '防曬建議' : 'Sun Protection',
          icon: '☀️',
          advice: lang === 'zh' ? '紫外線指數偏高，建議使用防曬用品' : 'High UV index - use sunscreen and protective clothing.',
          priority: 'high'
        });
      }
    }

    // Check for precipitation in forecast
    if (request.weatherData?.daily && request.weatherData.daily.length > 0) {
      const todayForecast = request.weatherData.daily[0];
      if (todayForecast.summary.precipitationChance > 60) {
        recommendations.push({
          category: lang === 'zh' ? '攜帶物品' : 'Items to Bring',
          icon: '☂️',
          advice: lang === 'zh' ? `降雨機率 ${todayForecast.summary.precipitationChance}%，建議攜帶雨具` : `${todayForecast.summary.precipitationChance}% chance of rain - bring an umbrella.`,
          priority: 'high'
        });
      }
    }

    // Default advice if no specific conditions
    if (recommendations.length === 0) {
      recommendations.push({
        category: lang === 'zh' ? '一般建議' : 'General',
        icon: '🌤️',
        advice: lang === 'zh' ? '天氣狀況良好，適合進行各種戶外活動' : 'Weather conditions are favorable for outdoor activities.',
        priority: 'low'
      });
    }

    return {
      success: true,
      advice: {
        summary: lang === 'zh' ? 
          `根據當前天氣狀況，為您提供以下建議：` :
          `Based on current weather conditions, here are our recommendations:`,
        recommendations,
        warnings: warnings.length > 0 ? warnings : undefined
      },
      source: 'rule_based'
    };
  }

  /**
   * Build Gemini prompt for weather advice
   */
  private buildAdvicePrompt(request: WeatherAdviceRequest): string {
    const language = request.language || 'en';
    const isZh = language.startsWith('zh') || /[\u4e00-\u9fa5]/.test(request.query);
    
    let prompt = isZh ? 
      `請根據以下天氣資訊和用戶查詢，提供實用的天氣建議：\n\n` :
      `Based on the following weather information and user query, provide practical weather advice:\n\n`;

    prompt += `**用戶查詢 / User Query:** ${request.query}\n`;
    
    if (request.context) {
      prompt += `**背景資訊 / Context:** ${request.context}\n`;
    }

    if (request.weatherData) {
      prompt += `\n**天氣資料 / Weather Data:**\n`;
      
      if (request.weatherData.current) {
        const current = request.weatherData.current;
        const temp = this.getTemperatureValue(current.temperature);
        
        prompt += `- 溫度 / Temperature: ${temp}°C\n`;
        prompt += `- 描述 / Description: ${current.description}\n`;
        prompt += `- 濕度 / Humidity: ${current.humidity}%\n`;
        prompt += `- 風速 / Wind Speed: ${current.windSpeed.kilometersPerHour} km/h\n`;
        if (current.uvIndex !== undefined) {
          prompt += `- UV指數 / UV Index: ${current.uvIndex}\n`;
        }
      }

      if (request.weatherData.daily && request.weatherData.daily.length > 0) {
        const today = request.weatherData.daily[0];
        prompt += `- 降雨機率 / Precipitation Chance: ${today.summary.precipitationChance}%\n`;
        prompt += `- 今日預報 / Today's Forecast: ${today.summary.description}\n`;
      }
    }

    prompt += isZh ? `\n請提供JSON格式的回應，包含：
{
  "summary": "簡要總結",
  "recommendations": [
    {
      "category": "建議類別",
      "icon": "emoji圖示",
      "advice": "具體建議",
      "priority": "high/medium/low"
    }
  ],
  "warnings": [
    {
      "type": "警告類型",
      "message": "警告訊息",
      "severity": "info/warning/critical"
    }
  ]
}

建議類別可包含：穿著建議、攜帶物品、戶外活動、交通建議、健康提醒等。` :
    `\nPlease provide a JSON response with:
{
  "summary": "Brief summary",
  "recommendations": [
    {
      "category": "Category name",
      "icon": "emoji icon",
      "advice": "Specific advice",
      "priority": "high/medium/low"
    }
  ],
  "warnings": [
    {
      "type": "Warning type", 
      "message": "Warning message",
      "severity": "info/warning/critical"
    }
  ]
}

Categories can include: Clothing, Items to Bring, Outdoor Activities, Transportation, Health Reminders, etc.`;

    return prompt;
  }

  /**
   * Get system instruction for Gemini
   */
  private getSystemInstruction(language?: string): string {
    const isZh = language?.startsWith('zh') || false;
    
    return isZh ?
      `你是一個專業的天氣顧問助手。請提供實用、可行動的天氣建議，重點關注用戶的安全和舒適度。回應必須是有效的JSON格式。` :
      `You are a professional weather advisor assistant. Provide practical, actionable weather advice focusing on user safety and comfort. Response must be valid JSON format.`;
  }

  /**
   * Parse AI response into structured advice
   */
  private parseAIResponse(content: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback: create structured response from text
      return {
        summary: content.substring(0, 200),
        recommendations: [{
          category: 'General',
          icon: '🌤️',
          advice: content,
          priority: 'medium' as const
        }]
      };
    } catch (error) {
      logger.warn('Failed to parse AI advice response', { content, error: error instanceof Error ? error.message : String(error) });
      
      return {
        summary: 'Weather advice generated',
        recommendations: [{
          category: 'General',
          icon: '🌤️', 
          advice: content,
          priority: 'medium' as const
        }]
      };
    }
  }

  /**
   * Extract temperature value from weather data
   */
  private getTemperatureValue(tempData: any): number {
    if (tempData && typeof tempData.degrees === 'number') {
      return tempData.degrees;
    }
    if (tempData && typeof tempData.celsius === 'number') {
      return tempData.celsius;
    }
    return 0;
  }
}
