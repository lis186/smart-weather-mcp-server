#!/usr/bin/env npx tsx

/**
 * Debug Google Weather API Response Format
 * Helps identify the actual response structure to fix parsing issues
 */

import axios from 'axios';
import { logger } from './src/services/logger.js';

async function debugApiResponse() {
  console.log('🔍 Debug Google Weather API Response Format\n');
  
  const apiKey = process.env.WEATHER_API_KEY || 'AIzaSyDTrMoVpq8yGL7SMbWRrrS7w7qw1CdzEwo';
  
  // Test with New York (known working location)
  const testLocation = {
    latitude: 40.7127753,
    longitude: -74.0059728,
    name: 'New York, NY, USA'
  };
  
  const params = {
    key: apiKey,
    'location.latitude': testLocation.latitude,
    'location.longitude': testLocation.longitude,
    unitsSystem: 'METRIC',
    languageCode: 'en'
  };
  
  try {
    console.log('📡 Making request to Google Weather API...');
    console.log('   URL:', 'https://weather.googleapis.com/v1/currentConditions:lookup');
    console.log('   Params:', { ...params, key: '[REDACTED]' });
    
    const response = await axios.get('https://weather.googleapis.com/v1/currentConditions:lookup', {
      params,
      timeout: 10000
    });
    
    console.log('\n✅ Response received successfully');
    console.log('   Status:', response.status);
    console.log('   Headers:', response.headers['content-type']);
    
    console.log('\n📄 Raw Response Data:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(response.data, null, 2));
    console.log('='.repeat(50));
    
    // Analyze the structure
    console.log('\n🔍 Response Structure Analysis:');
    if (response.data) {
      const data = response.data;
      console.log('   Top-level keys:', Object.keys(data));
      
      // Check for weather data
      if (data.current) {
        console.log('   Current weather found:', Object.keys(data.current));
      }
      if (data.location) {
        console.log('   Location data found:', Object.keys(data.location));
      }
      if (data.condition) {
        console.log('   Condition data found:', Object.keys(data.condition));
      }
      if (data.temperature) {
        console.log('   Temperature data:', data.temperature);
      }
    }
    
  } catch (error: any) {
    console.log('\n❌ API Request Failed');
    console.log('   Error:', error.message);
    console.log('   Status:', error.response?.status);
    console.log('   Response:', error.response?.data);
  }
}

// Run the debug
debugApiResponse()
  .then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });