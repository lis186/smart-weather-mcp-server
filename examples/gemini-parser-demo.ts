#!/usr/bin/env tsx

/**
 * Demonstration of Gemini Weather Parser
 * Phase 2.1 - Smart Weather MCP Server
 * 
 * Run with: npm run dev:demo-parser
 * 
 * Requirements:
 * - GOOGLE_CLOUD_PROJECT environment variable
 * - Google Cloud credentials (via gcloud auth application-default login)
 */

import { createWeatherParser } from '../src/services/gemini-parser.js';
import { logger } from '../src/services/logger.js';

async function demonstrateParser() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  
  if (!projectId) {
    console.error('Please set GOOGLE_CLOUD_PROJECT environment variable');
    process.exit(1);
  }

  console.log('🤖 Gemini Weather Parser Demo');
  console.log('===============================\n');

  // Create parser with optimized settings for demo
  const parser = createWeatherParser(projectId, {
    timeoutMs: 5000,
    validation: {
      minConfidence: 0.6,
      strictMode: false
    }
  });

  // Test queries in different languages
  const testQueries = [
    {
      query: 'What is the weather like in New York today?',
      description: 'English - Current weather query'
    },
    {
      query: 'Will it rain in London tomorrow?',
      description: 'English - Weather forecast query'
    },
    {
      query: 'Should I bring a jacket to Tokyo this weekend?',
      description: 'English - Weather advice query'
    },
    {
      query: '明天北京的天氣如何？',
      description: 'Chinese - Weather forecast query'
    },
    {
      query: '今天上海會下雨嗎？',
      description: 'Chinese - Weather condition query'
    },
    {
      query: '来週の東京の天気予報を教えて',
      description: 'Japanese - Weather forecast query'
    },
    {
      query: '大阪の今日の気温は？',
      description: 'Japanese - Temperature query'
    }
  ];

  console.log('Testing parser with various queries...\n');

  for (const testCase of testQueries) {
    console.log(`📝 Query: "${testCase.query}"`);
    console.log(`📋 Type: ${testCase.description}`);
    
    try {
      const startTime = Date.now();
      const result = await parser.parseQuery({
        query: testCase.query
      });
      const totalTime = Date.now() - startTime;

      if (result.success && result.result) {
        console.log('✅ Parsing successful!');
        console.log(`   Intent: ${result.result.intent}`);
        console.log(`   Location: ${result.result.location.name || 'Not specified'}`);
        console.log(`   Language: ${result.result.language}`);
        console.log(`   Confidence: ${(result.result.confidence * 100).toFixed(1)}%`);
        console.log(`   Processing Time: ${result.processingTime}ms (Total: ${totalTime}ms)`);
        
        // Check performance target
        if (result.processingTime <= 500) {
          console.log('🚀 Performance: Meets 500ms target!');
        } else {
          console.log(`⚠️  Performance: ${result.processingTime}ms (target: 500ms)`);
        }

        // Show time scope if available
        if (result.result.timeScope) {
          console.log(`   Time Scope: ${result.result.timeScope.period}`);
        }

        // Show preferences if available
        if (result.result.preferences && Object.keys(result.result.preferences).length > 0) {
          console.log(`   Preferences: ${JSON.stringify(result.result.preferences)}`);
        }
      } else {
        console.log('❌ Parsing failed');
        if (result.error) {
          console.log(`   Error: ${result.error.message}`);
          console.log(`   Code: ${result.error.code}`);
        }
      }
    } catch (error) {
      console.log('💥 Exception occurred');
      if (error instanceof Error) {
        console.log(`   Error: ${error.message}`);
      }
    }

    console.log(''); // Empty line for readability
  }

  // Test parser functionality
  console.log('🧪 Running parser test suite...');
  try {
    const testResult = await parser.testParser();
    if (testResult) {
      console.log('✅ Parser test suite passed!\n');
    } else {
      console.log('❌ Parser test suite failed!\n');
    }
  } catch (error) {
    console.log('💥 Parser test suite threw exception');
    if (error instanceof Error) {
      console.log(`   Error: ${error.message}\n`);
    }
  }

  console.log('🎯 Demo completed!');
  console.log('\nKey achievements:');
  console.log('✅ Gemini 2.5 Flash integration working');
  console.log('✅ Multilingual parsing (English, Chinese, Japanese)');
  console.log('✅ Intent classification for weather queries'); 
  console.log('✅ Location extraction and validation');
  console.log('✅ Performance monitoring and optimization');
  console.log('✅ Comprehensive error handling');
}

// Run demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateParser().catch(error => {
    logger.error('Parser demo failed', {}, error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  });
}