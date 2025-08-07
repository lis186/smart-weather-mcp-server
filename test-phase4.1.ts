#!/usr/bin/env npx tsx

/**
 * Phase 4.1 Test Script - Search Weather Tool Integration
 * Tests the real weather data integration with the MCP tool
 */

import { ToolHandlerService } from './src/services/tool-handlers.js';

async function testSearchWeatherTool() {
  console.log('🧪 Testing Phase 4.1: Search Weather Tool Integration\n');
  
  const testCases = [
    {
      name: 'Basic weather search',
      query: 'weather in Tokyo',
      context: undefined
    },
    {
      name: 'Weather with time context',
      query: 'Taipei weather tomorrow',
      context: 'user prefers detailed information'
    },
    {
      name: 'Complex Chinese query',
      query: '台北明天天氣預報',
      context: undefined
    },
    {
      name: 'Weather for activity',
      query: 'is it good weather for surfing in Okinawa',
      context: 'planning outdoor activity'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📍 Test: ${testCase.name}`);
    console.log(`   Query: "${testCase.query}"`);
    if (testCase.context) {
      console.log(`   Context: "${testCase.context}"`);
    }
    
    try {
      const result = await ToolHandlerService.handleToolCall('search_weather', {
        query: testCase.query,
        context: testCase.context
      });
      
      console.log('\n✅ Response received:');
      if (result && result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text') {
            // Just show first 500 characters to keep output manageable
            const preview = item.text.substring(0, 500);
            console.log(preview);
            if (item.text.length > 500) {
              console.log('... [truncated]');
            }
          }
        }
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  console.log('\n✨ Phase 4.1 Testing Complete!');
}

// Run the test
testSearchWeatherTool().catch(console.error);