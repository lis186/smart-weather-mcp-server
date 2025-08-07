#!/usr/bin/env npx tsx

/**
 * Test Enhanced Error Handling (Honest Transparency)
 * Specifically test Tokyo query to verify error handling is working
 */

import { ToolHandlerService } from './src/services/tool-handlers.js';
import { logger } from './src/services/logger.js';

async function testErrorHandling() {
  console.log('🧪 Testing Enhanced Error Handling\n');
  
  // Test 1: Tokyo (known unsupported location)
  console.log('Test 1: Tokyo query (should show error message)');
  console.log('=' .repeat(50));
  
  try {
    const tokyoResult = await ToolHandlerService.handleToolCall('search_weather', {
      query: 'Show me the weather in Tokyo, Japan',
      context: 'current conditions'
    });
    
    if (tokyoResult && tokyoResult.content && tokyoResult.content[0]) {
      console.log('Response received:');
      console.log(tokyoResult.content[0].text);
      console.log('\n');
      
      const response = tokyoResult.content[0].text;
      
      // Check for error indicators
      if (response.includes('Weather Information Not Available') || response.includes('not available') || response.includes('not supported')) {
        console.log('✅ ERROR HANDLING WORKING - Enhanced error message detected');
        if (response.includes('Suggestions:')) {
          console.log('✅ SUGGESTIONS PROVIDED - Actionable guidance included');
        }
        if (response.includes('Honest Transparency')) {
          console.log('✅ HONEST TRANSPARENCY - Philosophy message included');
        }
      } else if (response.includes('Temperature: 0.0°C')) {
        console.log('❌ RETURNING ZERO DATA - Should show error instead');
      } else {
        console.log('⚠️ UNEXPECTED RESPONSE - Check response format');
      }
    } else {
      console.log('❌ NO RESPONSE RECEIVED');
    }
  } catch (error: any) {
    console.log('❌ EXCEPTION THROWN:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
  
  // Test 2: New York (should work normally)
  console.log('\nTest 2: New York query (should show real data)');
  console.log('=' .repeat(50));
  
  try {
    const nycResult = await ToolHandlerService.handleToolCall('search_weather', {
      query: 'What is the weather in New York City?',
      context: 'current conditions'
    });
    
    if (nycResult && nycResult.content && nycResult.content[0]) {
      const response = nycResult.content[0].text;
      console.log('Response preview:', response.substring(0, 300) + '...\n');
      
      if (response.includes('Temperature:') && !response.includes('Temperature: 0.0°C')) {
        console.log('✅ REAL DATA WORKING - Non-zero temperature detected');
      } else if (response.includes('Temperature: 0.0°C')) {
        console.log('⚠️ ZERO DATA - Parsing issue detected');
      } else {
        console.log('❌ NO TEMPERATURE DATA - Response format issue');
      }
    } else {
      console.log('❌ NO RESPONSE RECEIVED');
    }
  } catch (error: any) {
    console.log('❌ EXCEPTION THROWN:', error.message);
  }
  
  console.log('\n✅ Error handling test completed');
}

// Run the test
testErrorHandling()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });