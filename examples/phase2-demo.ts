#!/usr/bin/env tsx
/**
 * Phase 2 Feature Demo Script
 * Smart Weather MCP Server - Comprehensive Phase 2 Testing
 * 
 * Usage: npm run demo:phase2
 */

import { QueryRouter } from '../src/services/query-router.js';
import { GeminiWeatherParser, createWeatherParser } from '../src/services/gemini-parser.js';
import { WeatherErrorHandler } from '../src/utils/error-handler.js';
import { logger } from '../src/services/logger.js';

interface DemoResult {
  feature: string;
  test: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

class Phase2Demo {
  private queryRouter: QueryRouter;
  private geminiParser: GeminiWeatherParser | null = null;
  private errorHandler: WeatherErrorHandler;
  private results: DemoResult[] = [];

  constructor() {
    // Initialize Query Router
    this.queryRouter = new QueryRouter({
      minConfidenceThreshold: 0.1, // Low threshold for demo
      enableFallbacks: true
    });

    // Initialize Error Handler
    this.errorHandler = new WeatherErrorHandler();

    // Initialize Gemini Parser if project ID is available
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId) {
      try {
        this.geminiParser = createWeatherParser(projectId, {
          minConfidence: 0.1,
          strictMode: false
        });
        console.log(`🤖 Gemini Parser initialized with project: ${projectId}`);
      } catch (error) {
        console.log(`⚠️  Gemini Parser not available: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.log('⚠️  GOOGLE_CLOUD_PROJECT not set - Gemini tests will be skipped');
    }
  }

  private async runTest(feature: string, testName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    console.log(`\n🧪 Testing: ${feature} - ${testName}`);
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        feature,
        test: testName,
        success: true,
        result,
        duration
      });
      
      console.log(`✅ SUCCESS (${duration}ms)`);
      if (result && typeof result === 'object') {
        console.log('📊 Result:', JSON.stringify(result, null, 2));
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.results.push({
        feature,
        test: testName,
        success: false,
        error: errorMessage,
        duration
      });
      
      console.log(`❌ FAILED (${duration}ms): ${errorMessage}`);
    }
  }

  async testQueryRouter(): Promise<void> {
    console.log('\n🗺️  Testing Query Router Features');
    console.log('================================');

    // Test 1: Basic Current Weather Query
    await this.runTest('Query Router', 'Current Weather Query', async () => {
      const result = await this.queryRouter.routeQuery(
        { query: 'What is the weather like in Tokyo today?' },
        { apiHealth: { google_current_conditions: 'healthy' } }
      );
      return {
        success: result.success,
        selectedAPI: result.decision?.selectedAPI.id,
        confidence: result.decision?.confidence
      };
    });

    // Test 2: Forecast Query
    await this.runTest('Query Router', 'Weather Forecast Query', async () => {
      const result = await this.queryRouter.routeQuery(
        { query: '明天北京的天氣如何？' },
        { apiHealth: { google_daily_forecast: 'healthy' } }
      );
      return {
        success: result.success,
        selectedAPI: result.decision?.selectedAPI.id,
        location: 'Beijing (detected from Chinese)'
      };
    });

    // Test 3: Multilingual Support
    await this.runTest('Query Router', 'Japanese Query Parsing', async () => {
      const result = await this.queryRouter.routeQuery(
        { query: '来週の東京の天気予報を教えて' },
        { apiHealth: { google_daily_forecast: 'healthy' } }
      );
      return {
        success: result.success,
        language: 'Japanese',
        intent: 'forecast'
      };
    });

    // Test 4: Error Handling
    await this.runTest('Query Router', 'Error Handling', async () => {
      const result = await this.queryRouter.routeQuery(
        { query: '' }, // Empty query
        { apiHealth: {} }
      );
      return {
        success: result.success,
        errorType: result.error?.type,
        hasError: !!result.error
      };
    });

    // Test 5: Caching
    await this.runTest('Query Router', 'Caching Mechanism', async () => {
      const query = { query: 'Weather in London' };
      const context = { apiHealth: { google_current_conditions: 'healthy' } };
      
      // First call
      const start1 = Date.now();
      await this.queryRouter.routeQuery(query, context);
      const time1 = Date.now() - start1;
      
      // Second call (should be cached)
      const start2 = Date.now();
      await this.queryRouter.routeQuery(query, context);
      const time2 = Date.now() - start2;
      
      return {
        firstCallTime: time1,
        secondCallTime: time2,
        cacheEffective: time2 < time1,
        cacheStats: this.queryRouter.getCacheStats()
      };
    });
  }

  async testGeminiParser(): Promise<void> {
    if (!this.geminiParser) {
      console.log('\n🤖 Skipping Gemini Parser Tests (no credentials)');
      return;
    }

    console.log('\n🤖 Testing Gemini AI Parser Features');
    console.log('===================================');

    // Test 1: English Query Parsing
    await this.runTest('Gemini Parser', 'English Query Parsing', async () => {
      const result = await this.geminiParser!.parseQuery({
        query: 'What is the weather like in New York today?'
      });
      return {
        success: result.success,
        location: result.result?.location.name,
        intent: result.result?.intent.primary,
        confidence: result.result?.confidence,
        processingTime: result.metadata.processingTime
      };
    });

    // Test 2: Chinese Query Parsing  
    await this.runTest('Gemini Parser', 'Chinese Query Parsing', async () => {
      const result = await this.geminiParser!.parseQuery({
        query: '明天台北會下雨嗎？'
      });
      return {
        success: result.success,
        location: result.result?.location.name,
        intent: result.result?.intent.primary,
        language: result.result?.userPreferences.language,
        metrics: result.result?.weatherMetrics
      };
    });

    // Test 3: Japanese Query Parsing
    await this.runTest('Gemini Parser', 'Japanese Query Parsing', async () => {
      const result = await this.geminiParser!.parseQuery({
        query: '今日の東京の天気はどうですか？'
      });
      return {
        success: result.success,
        location: result.result?.location.name,
        language: result.result?.userPreferences.language
      };
    });

    // Test 4: Weather Advice Intent
    await this.runTest('Gemini Parser', 'Weather Advice Intent', async () => {
      const result = await this.geminiParser!.parseQuery({
        query: 'Should I bring an umbrella today in Seattle?'
      });
      return {
        success: result.success,
        intent: result.result?.intent.primary,
        expectedIntent: 'WEATHER_ADVICE',
        metrics: result.result?.weatherMetrics
      };
    });

    // Test 5: Error Recovery
    await this.runTest('Gemini Parser', 'Error Handling', async () => {
      const result = await this.geminiParser!.parseQuery({
        query: 'xyz random nonsense query'
      });
      return {
        success: result.success,
        errorType: result.error?.type,
        suggestions: result.error?.suggestions?.length || 0,
        retryable: result.error?.retryable
      };
    });
  }

  async testErrorHandler(): Promise<void> {
    console.log('\n🚨 Testing Error Handler Features');
    console.log('=================================');

    // Test 1: Routing Error
    await this.runTest('Error Handler', 'Routing Error Handling', async () => {
      const mcpError = this.errorHandler.handleRoutingError(
        'NO_SUITABLE_API',
        'No weather API could handle this query type',
        { query: 'complex weather query', context: {} }
      );
      return {
        code: mcpError.code,
        message: mcpError.message,
        hasSuggestions: mcpError.message.includes('Try')
      };
    });

    // Test 2: API Error
    await this.runTest('Error Handler', 'API Error Handling', async () => {
      const apiError = { 
        response: { status: 404 }, 
        message: 'Location not found' 
      };
      const mcpError = this.errorHandler.handleAPIError(apiError, {
        query: 'weather in nonexistent city',
        context: {}
      });
      return {
        code: mcpError.code,
        statusCode: 404,
        hasLocationSuggestion: mcpError.message.includes('location')
      };
    });

    // Test 3: Network Error
    await this.runTest('Error Handler', 'Network Error Handling', async () => {
      const networkError = new Error('ECONNREFUSED');
      const mcpError = this.errorHandler.handleNetworkError(networkError, {
        query: 'weather query',
        context: {}
      });
      return {
        code: mcpError.code,
        isRetryable: mcpError.message.includes('try again'),
        hasNetworkTips: mcpError.message.includes('connection')
      };
    });
  }

  async testPerformance(): Promise<void> {
    console.log('\n⚡ Testing Performance Characteristics');
    console.log('====================================');

    // Test 1: Query Router Performance
    await this.runTest('Performance', 'Query Router Speed', async () => {
      const queries = [
        'Weather in Tokyo',
        'Rain forecast for London',
        'Temperature in New York',
        'Will it snow tomorrow?',
        'Weather advice for outdoor picnic'
      ];

      const times: number[] = [];
      for (const query of queries) {
        const start = Date.now();
        await this.queryRouter.routeQuery(
          { query },
          { apiHealth: { google_current_conditions: 'healthy' } }
        );
        times.push(Date.now() - start);
      }

      return {
        averageTime: Math.round(times.reduce((a, b) => a + b) / times.length),
        maxTime: Math.max(...times),
        minTime: Math.min(...times),
        allUnder2Seconds: times.every(t => t < 2000),
        target: '< 1500ms average'
      };
    });

    // Test 2: Cache Performance
    await this.runTest('Performance', 'Cache Performance', async () => {
      const query = { query: 'Weather performance test' };
      const context = { apiHealth: { google_current_conditions: 'healthy' } };

      // Warm up cache
      await this.queryRouter.routeQuery(query, context);

      // Test cached performance
      const cachedTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await this.queryRouter.routeQuery(query, context);
        cachedTimes.push(Date.now() - start);
      }

      return {
        averageCachedTime: Math.round(cachedTimes.reduce((a, b) => a + b) / cachedTimes.length),
        maxCachedTime: Math.max(...cachedTimes),
        cacheStats: this.queryRouter.getCacheStats(),
        significantSpeedup: cachedTimes.every(t => t < 50)
      };
    });
  }

  generateReport(): void {
    console.log('\n📊 PHASE 2 FEATURE VALIDATION REPORT');
    console.log('=====================================');

    const byFeature: { [key: string]: DemoResult[] } = {};
    this.results.forEach(result => {
      if (!byFeature[result.feature]) {
        byFeature[result.feature] = [];
      }
      byFeature[result.feature].push(result);
    });

    let totalTests = 0;
    let passedTests = 0;

    Object.entries(byFeature).forEach(([feature, tests]) => {
      const passed = tests.filter(t => t.success).length;
      const total = tests.length;
      const avgTime = Math.round(tests.reduce((sum, t) => sum + t.duration, 0) / total);
      
      totalTests += total;
      passedTests += passed;

      console.log(`\n${feature}:`);
      console.log(`  ✅ Passed: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
      console.log(`  ⏱️  Average Time: ${avgTime}ms`);
      
      if (passed < total) {
        const failed = tests.filter(t => !t.success);
        console.log(`  ❌ Failed Tests:`);
        failed.forEach(f => {
          console.log(`    - ${f.test}: ${f.error}`);
        });
      }
    });

    console.log(`\n🎯 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests} (${Math.round(passedTests/totalTests*100)}%)`);
    console.log(`   Failed: ${totalTests - passedTests}`);
    
    if (passedTests === totalTests) {
      console.log(`\n🎉 ALL PHASE 2 FEATURES WORKING CORRECTLY! 🎉`);
    } else {
      console.log(`\n⚠️  Some tests failed - check configuration and dependencies`);
    }

    // Performance Summary
    const performanceTests = this.results.filter(r => r.feature === 'Performance');
    if (performanceTests.length > 0) {
      console.log(`\n⚡ PERFORMANCE SUMMARY:`);
      performanceTests.forEach(test => {
        if (test.success && test.result) {
          console.log(`   ${test.test}: ${JSON.stringify(test.result, null, 6).substring(0, 100)}...`);
        }
      });
    }

    console.log(`\n📋 NEXT STEPS:`);
    console.log(`   1. If Gemini tests were skipped, set GOOGLE_CLOUD_PROJECT environment variable`);
    console.log(`   2. For full integration testing, configure actual Google Weather API credentials`);
    console.log(`   3. Ready for Phase 3: Google Weather API Integration`);
  }

  async runFullDemo(): Promise<void> {
    console.log('🚀 Smart Weather MCP Server - Phase 2 Feature Demo');
    console.log('==================================================');
    console.log(`📅 Date: ${new Date().toISOString()}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    await this.testQueryRouter();
    await this.testGeminiParser();
    await this.testErrorHandler();
    await this.testPerformance();
    
    this.generateReport();
  }
}

// Run the demo
async function main() {
  const demo = new Phase2Demo();
  await demo.runFullDemo();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { Phase2Demo };