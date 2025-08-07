#!/usr/bin/env npx tsx

/**
 * Test Location Extraction
 * Directly test LocationService.extractLocationFromText
 */

import { LocationService } from './src/services/location-service.js';
import type { WeatherAPIConfig } from './src/types/weather-api.js';

async function testLocationExtraction() {
  console.log('🗺️ Testing Location Extraction\n');
  
  const config: WeatherAPIConfig = {
    apiKey: process.env.WEATHER_API_KEY || 'AIzaSyDTrMoVpq8yGL7SMbWRrrS7w7qw1CdzEwo'
  };
  
  const locationService = new LocationService(config);
  
  const testCases = [
    '倫敦 weather',
    '台北 weather',
    '東京 weather',
    '紐約現在幾度？',
    '倫敦現在天氣如何？',
    'London weather',
    'Tokyo weather',
    'weather in New York',
    'Singapore forecast'
  ];
  
  for (const testCase of testCases) {
    console.log(`Testing: "${testCase}"`);
    const extracted = locationService.extractLocationFromText(testCase);
    console.log('   Extracted locations:', extracted);
    console.log('');
  }
  
  console.log('✅ Location extraction test completed');
}

// Run the test
testLocationExtraction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });