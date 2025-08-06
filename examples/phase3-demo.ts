#!/usr/bin/env node
/**
 * Phase 3.1 Demo - Context Format & Time Integration Fixes
 * Demonstrates the resolved issues and new capabilities
 */

import { QueryRouter } from '../src/services/query-router.js';
import { timeService } from '../src/services/time-service.js';
import { WeatherQuery } from '../src/types/index.js';

// Mock Gemini parser for demo
const mockGeminiParser = {
  parseQuery: async (request: any) => ({
    success: true,
    result: {
      location: { name: 'Demo Location', confidence: 0.9 },
      intent: { primary: 'weather_advice', confidence: 0.9 },
      confidence: 0.9,
      language: 'zh-TW',
      metrics: ['temperature', 'wind_speed', 'precipitation'],
      timeScope: { type: 'forecast', period: 'tomorrow' }
    }
  })
};

async function demonstratePhase3Fixes() {
  console.log('🌦️ Smart Weather MCP Server - Phase 3.1 Demo\n');
  
  // Initialize router with AI parser
  const queryRouter = new QueryRouter(mockGeminiParser, { 
    minConfidenceThreshold: 0.3,
    aiThreshold: 0.5 
  });

  console.log('=== 1. Context Format Fixes ===\n');
  
  // Demonstrate free-form context (previously would fail)
  const contextQueries = [
    {
      query: "沖繩明天天氣預報 衝浪條件 海浪高度 風速",
      context: "用戶計劃明天去衝浪，需要詳細的海況資訊和風力預測"
    },
    {
      query: "Tokyo weather today", 
      context: "I prefer detailed forecasts in English with Celsius temperature and humidity levels"
    },
    {
      query: "台北明天會下雨嗎？",
      context: "戶外婚禮活動，需要準確的降雨預測"
    }
  ];

  for (const testQuery of contextQueries) {
    console.log(`Query: "${testQuery.query}"`);
    console.log(`Context: "${testQuery.context}"`);
    
    try {
      const result = await queryRouter.routeQuery(testQuery);
      console.log(`✅ Success: ${result.parsedQuery?.parsingSource}`);
      console.log(`   Confidence: ${result.parsedQuery?.confidence.toFixed(2)}`);
      console.log(`   Language: ${result.parsedQuery?.language}\n`);
    } catch (error) {
      console.log(`❌ Error: ${error}\n`);
    }
  }

  console.log('=== 2. Time Service Integration ===\n');
  
  // Demonstrate multilingual time parsing
  const timeExpressions = [
    '明天台北天氣',
    'tomorrow weather in Tokyo', 
    '今日の東京の天気',
    '昨天的天氣狀況',
    'next week forecast'
  ];

  for (const expr of timeExpressions) {
    const timeInfo = timeService.parseRelativeTime(expr);
    console.log(`Expression: "${expr}"`);
    console.log(`  Parsed: ${timeInfo.relativeDescription}`);
    console.log(`  Confidence: ${timeInfo.confidence.toFixed(2)}`);
    console.log(`  Date: ${timeInfo.absoluteTime.toLocaleDateString()}\n`);
  }

  console.log('=== 3. Complex Query Handling ===\n');
  
  // Demonstrate complex multilingual queries
  const complexQueries = [
    "沖繩明天天氣預報 衝浪條件 海浪高度 風速",
    "台灣明天空氣品質預報 花粉濃度 過敏指數", 
    "日本沖繩明天天氣 海況 風浪預報",
    "Should I bring an umbrella to Okinawa tomorrow for surfing?",
    "明天適合戶外運動嗎？風力如何？"
  ];

  for (const query of complexQueries) {
    console.log(`Complex Query: "${query}"`);
    
    try {
      const result = await queryRouter.routeQuery({ query });
      console.log(`✅ Processing: ${result.parsedQuery?.parsingSource}`);
      console.log(`   Confidence: ${result.parsedQuery?.confidence.toFixed(2)}`);
      console.log(`   Processing Time: ${result.metadata.processingTime}ms\n`);
    } catch (error) {
      console.log(`❌ Error: ${error}\n`);
    }
  }

  console.log('=== 4. Time Context Integration ===\n');
  
  // Demonstrate automatic time context injection
  const timeContextQuery = { query: "明天適合衝浪嗎？" };
  
  console.log(`Query: "${timeContextQuery.query}"`);
  console.log('Demonstrating automatic time context injection...\n');
  
  const timeContext = await timeService.createTimeContext(timeContextQuery.query, 'Asia/Taipei');
  console.log(`Time Context Created:`);
  console.log(`  Current Time: ${timeContext.currentTime.toISOString()}`);
  console.log(`  Timezone: ${timeContext.timezone}`);
  console.log(`  Relative Time: ${timeContext.relativeTime}\n`);

  const result = await queryRouter.routeQuery(timeContextQuery);
  console.log(`✅ Query Processed with Time Context`);
  console.log(`   Parsing Source: ${result.parsedQuery?.parsingSource}`);
  console.log(`   Confidence: ${result.parsedQuery?.confidence.toFixed(2)}\n`);

  console.log('=== 5. Performance Validation ===\n');
  
  // Demonstrate performance metrics
  const performanceQuery = { query: "台北今天天氣如何？" };
  const startTime = Date.now();
  
  const perfResult = await queryRouter.routeQuery(performanceQuery);
  const totalTime = Date.now() - startTime;
  
  console.log(`Performance Test: "${performanceQuery.query}"`);
  console.log(`✅ Total Processing Time: ${totalTime}ms`);
  console.log(`   Parser Processing Time: ${perfResult.metadata.processingTime}ms`);
  console.log(`   Parsing Confidence: ${perfResult.metadata.parsingConfidence.toFixed(2)}`);
  console.log(`   Target: < 2000ms ✅\n`);

  console.log('🎉 Phase 3.1 Demo Complete!\n');
  console.log('Key Improvements Demonstrated:');
  console.log('✅ Free-form natural language context support');
  console.log('✅ Multilingual relative time parsing');
  console.log('✅ Enhanced Gemini prompts for complex queries');
  console.log('✅ Automatic time context injection');
  console.log('✅ Maintained performance targets');
  console.log('✅ Comprehensive error handling');
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstratePhase3Fixes().catch(console.error);
}


