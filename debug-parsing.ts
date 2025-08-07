#!/usr/bin/env npx tsx

/**
 * Debug Weather Data Parsing
 * Check why New York temperature shows 0.0°C instead of real data
 */

import { GoogleWeatherClient } from './src/services/google-weather-client.js';
import { logger } from './src/services/logger.js';
import type { WeatherAPIConfig } from './src/types/weather-api.js';

async function debugParsing() {
  console.log('🔍 Debug Weather Data Parsing\n');
  
  const config: WeatherAPIConfig = {
    apiKey: process.env.WEATHER_API_KEY || 'AIzaSyDTrMoVpq8yGL7SMbWRrrS7w7qw1CdzEwo'
  };
  
  const client = new GoogleWeatherClient(config);
  
  const testLocation = {
    latitude: 40.7127753,
    longitude: -74.0059728,
    name: 'New York, NY, USA',
    country: 'United States',
    region: 'New York'
  };
  
  try {
    console.log('📡 Fetching current weather for New York...');
    const result = await client.getCurrentWeather({
      location: testLocation,
      units: 'metric',
      language: 'en'
    });
    
    console.log('\n✅ Result received:');
    console.log('   Success:', result.success);
    
    if (result.success && result.data) {
      const data = result.data;
      console.log('\n🌡️ Parsed Data:');
      console.log('   Temperature (C):', data.temperature.celsius);
      console.log('   Temperature (F):', data.temperature.fahrenheit);
      console.log('   Description:', data.description);
      console.log('   Humidity:', data.humidity + '%');
      console.log('   Wind Speed:', data.windSpeed.kilometersPerHour + ' km/h');
      console.log('   Pressure:', data.pressure + ' hPa');
      console.log('   UV Index:', data.uvIndex);
      console.log('   Visibility:', data.visibility + ' km');
      
      // Check if we have real or mock data
      if (data.temperature.celsius > 0 && data.temperature.celsius !== 20) {
        console.log('\n✅ REAL DATA DETECTED - Temperature is realistic');
      } else if (data.temperature.celsius === 20 || data.temperature.celsius === 0) {
        console.log('\n⚠️ POSSIBLE MOCK DATA - Temperature is default value');
      }
      
      if (data.visibility !== 10000 && data.visibility !== 10) {
        console.log('✅ REAL VISIBILITY - Not default value');
      } else {
        console.log('⚠️ DEFAULT VISIBILITY - May be fallback value');
      }
      
    } else if (result.error) {
      console.log('\n❌ Error Result:');
      console.log('   Code:', result.error.code);
      console.log('   Message:', result.error.message);
      console.log('   Details:', result.error.details);
    }
    
  } catch (error: any) {
    console.log('\n❌ Exception thrown:', error.message);
  }
  
  console.log('\n✅ Debug parsing completed');
}

// Run the debug
debugParsing()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });