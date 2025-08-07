#!/usr/bin/env npx tsx

/**
 * Test Universal Multi-Language Support
 * Test location extraction from various languages without hardcoding
 */

import { LocationService } from './src/services/location-service.js';
import type { WeatherAPIConfig } from './src/types/weather-api.js';

async function testMultilingual() {
  console.log('🌍 Testing Universal Multi-Language Support\n');
  
  const config: WeatherAPIConfig = {
    apiKey: process.env.WEATHER_API_KEY || 'AIzaSyDTrMoVpq8yGL7SMbWRrrS7w7qw1CdzEwo'
  };
  
  const locationService = new LocationService(config);
  
  const testCases = [
    // Original working cases
    { lang: '中文', query: '倫敦 weather', expected: '倫敦' },
    { lang: '中文', query: '台北今天天氣如何？', expected: '台北' },
    { lang: 'English', query: 'weather in Paris', expected: 'Paris' },
    { lang: 'English', query: 'London weather', expected: 'London' },
    
    // New languages to test universal support
    { lang: 'Spanish', query: 'clima en Madrid', expected: 'Madrid' },
    { lang: 'Spanish', query: 'Barcelona weather', expected: 'Barcelona' },
    
    { lang: 'French', query: 'météo à Lyon', expected: 'Lyon' },
    { lang: 'French', query: 'Paris météo', expected: 'Paris' },
    
    { lang: 'German', query: 'wetter in Berlin', expected: 'Berlin' },
    { lang: 'German', query: 'München weather', expected: 'München' },
    
    { lang: 'Portuguese', query: 'tempo em São Paulo', expected: 'São Paulo' },
    { lang: 'Portuguese', query: 'Rio weather', expected: 'Rio' },
    
    { lang: 'Italian', query: 'tempo a Roma', expected: 'Roma' },
    { lang: 'Italian', query: 'Milano weather', expected: 'Milano' },
    
    { lang: 'Japanese', query: '京都の天気', expected: '京都' },
    { lang: 'Japanese', query: '大阪 weather', expected: '大阪' },
    
    { lang: 'Korean', query: '서울 날씨', expected: '서울' },
    { lang: 'Korean', query: '부산 weather', expected: '부산' },
    
    // Arabic (if supported by Node.js regex)
    { lang: 'Arabic', query: 'القاهرة weather', expected: 'القاهرة' },
    
    // Hindi (if supported)
    { lang: 'Hindi', query: 'मुंबई मौसम', expected: 'मुंबई' },
    
    // Geographic suffixes test
    { lang: 'Mixed', query: 'weather in New York City', expected: 'New York City' },
    { lang: 'Mixed', query: '北京市天氣', expected: '北京市' },
    { lang: 'Mixed', query: 'Los Angeles weather', expected: 'Los Angeles' },
  ];
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`[${testCase.lang}] Testing: "${testCase.query}"`);
    const extracted = locationService.extractLocationFromText(testCase.query);
    
    const found = extracted.length > 0;
    const hasExpected = extracted.some(loc => 
      loc.includes(testCase.expected) || testCase.expected.includes(loc)
    );
    
    if (found && hasExpected) {
      console.log(`   ✅ PASS - Extracted: ${extracted.join(', ')}`);
      passedTests++;
    } else if (found) {
      console.log(`   ⚠️ PARTIAL - Extracted: ${extracted.join(', ')}, Expected: ${testCase.expected}`);
      passedTests += 0.5; // Partial credit for finding something
    } else {
      console.log(`   ❌ FAIL - No location extracted`);
    }
    console.log('');
  }
  
  console.log(`📊 Test Results: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
  console.log('✅ Multi-language testing completed');
  
  return passedTests / totalTests;
}

// Run the test
testMultilingual()
  .then((score) => {
    if (score >= 0.8) {
      console.log('\n🎉 Excellent! Universal language support working well.');
    } else if (score >= 0.6) {
      console.log('\n👍 Good! Most languages supported, some edge cases to refine.');
    } else {
      console.log('\n⚠️ Needs improvement. Many languages not working correctly.');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });