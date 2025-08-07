#!/usr/bin/env npx tsx

/**
 * Test Chinese Query Support
 * Specifically test Chinese location extraction and parsing
 */

import { ToolHandlerService } from './src/services/tool-handlers.js';

async function testChineseQueries() {
  console.log('🇨🇳 Testing Chinese Query Support\n');
  
  const testCases = [
    {
      name: 'London in Chinese',
      query: '倫敦現在天氣如何？',
      expectedLocation: 'London' 
    },
    {
      name: 'Taipei weather',
      query: '台北今天天氣如何？',
      expectedLocation: 'Taipei'
    },
    {
      name: 'Tokyo weather in Chinese',
      query: '東京明天天氣預報',
      expectedLocation: 'Tokyo'
    },
    {
      name: 'New York in Chinese',
      query: '紐約現在幾度？',
      expectedLocation: 'New York'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`Query: "${testCase.query}"`);
    console.log('='.repeat(50));
    
    try {
      const result = await ToolHandlerService.handleToolCall('search_weather', {
        query: testCase.query,
        context: '中文查詢測試'
      });
      
      if (result && result.content && result.content[0]) {
        const response = result.content[0].text;
        
        // Check if location was found
        if (response.includes('Weather Search Results')) {
          console.log('✅ LOCATION FOUND - Weather results returned');
          
          // Extract location from response
          const locationMatch = response.match(/Location:\*\*\s*([^,\n]+)/);
          if (locationMatch) {
            console.log(`   Detected location: ${locationMatch[1]}`);
          }
        } else if (response.includes('No location found')) {
          console.log('❌ LOCATION NOT FOUND - Parser failed');
        } else if (response.includes('Weather Information Not Available')) {
          console.log('⚠️ LOCATION FOUND BUT DATA UNAVAILABLE');
        } else {
          console.log('❓ UNEXPECTED RESPONSE FORMAT');
        }
        
        console.log('   Preview:', response.substring(0, 200) + '...\n');
      } else {
        console.log('❌ NO RESPONSE RECEIVED\n');
      }
    } catch (error: any) {
      console.log('❌ EXCEPTION:', error.message, '\n');
    }
  }
  
  console.log('✅ Chinese query testing completed');
}

// Run the test
testChineseQueries()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });