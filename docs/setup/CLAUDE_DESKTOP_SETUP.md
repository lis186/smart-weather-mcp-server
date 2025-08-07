# 🖥️ Claude Desktop Integration Guide - Phase 4.1 Testing

## Step-by-Step Setup

### 1. Ensure Your Server is Built
```bash
npm run build
```

### 2. Configure Claude Desktop

**Location of config file:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration content** (Phase 4.1 Updated):
```json
{
  "mcpServers": {
    "smart-weather": {
      "command": "node",
      "args": [
        "/Users/justinlee/dev/smart-weather-mcp-server/dist/unified-server.js",
        "--mode=stdio"
      ],
      "env": {
        "NODE_ENV": "development",
        "GEMINI_API_KEY": "AIzaSyBwckixxEeVYE6o0VwI15hWXCAfjq-nqMM",
        "WEATHER_API_KEY": "AIzaSyDTrMoVpq8yGL7SMbWRrrS7w7qw1CdzEwo",
        "GOOGLE_CLOUD_PROJECT": "striped-history-467517-m3"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After updating the configuration, **completely quit and restart Claude Desktop** for the changes to take effect.

### 4. Test Phase 4.1 Features in Claude Desktop

Open Claude Desktop and try these **Phase 4.1** test queries to verify the real weather data integration:

#### Test 1: Basic Weather Query with Real Data
```
Use the smart-weather MCP server: What is the weather like in Tokyo today?
```

**Expected Phase 4.1 response**: Should show real weather data including:
- 📍 Location details with coordinates
- 🌡️ Current temperature in Celsius
- Weather conditions (humidity, wind, pressure, UV index)
- Data source (Cached/Live)
- Parser type used (Rule-based or Gemini AI)

#### Test 2: Weather Forecast Query
```
Use the smart-weather server: Show me the weather forecast for Taipei for the next 5 days
```

**Expected Phase 4.1 response**: Should display:
- 📅 Daily forecast with high/low temperatures
- Weather descriptions for each day
- Precipitation chances
- Formatted date display (day names)

#### Test 3: Chinese Query with Full Integration
```
Use the smart-weather server: 台北明天天氣如何？需要帶傘嗎？
```

**Expected Phase 4.1 response**: Should provide:
- Weather parsed in Chinese
- Tomorrow's forecast data
- Rain probability information
- All data formatted in metric units

#### Test 4: Hourly Weather Data
```
Ask the smart-weather server: Show me hourly weather for London for the next 6 hours
```

**Expected Phase 4.1 response**: Should include:
- ⏰ Hourly forecast section
- Temperature for each hour
- Weather conditions per hour
- Precipitation probability

#### Test 5: Complex Activity Query
```
Use the smart-weather server: Is it good weather for surfing in Okinawa this weekend?
```

**Expected Phase 4.1 response**: Should show:
- Location identification (Okinawa)
- Weekend weather data
- Marine conditions if available
- Activity-relevant metrics (wind, waves if supported)

### 5. Phase 4.1 Verification Signs

✅ **Phase 4.1 Success indicators:**
- Claude Desktop shows the MCP server as connected
- Tool calls return **real weather data** with formatted output
- **Current conditions** include temperature, humidity, wind, pressure, UV index
- **Forecast data** shows multiple days with high/low temperatures
- **Hourly data** displays when requested
- **Cache status** shows whether data is from cache or live API
- **Multi-language support** works for Chinese, English, and Japanese queries
- **Error messages** are informative and suggest corrections

❌ **Troubleshooting if it doesn't work:**

1. **Check Claude Desktop logs** (if available)
2. **Verify file paths** in the config point to `dist/unified-server.js`
3. **Test manually**:
   ```bash
   node dist/unified-server.js --mode=stdio
   # Should show: "Smart Weather MCP Server running in STDIO mode"
   ```
4. **Restart Claude Desktop** completely after config changes
5. **Check environment variables** are set correctly (especially GOOGLE_CLOUD_PROJECT)

### 6. Manual Testing

Test the Phase 2 unified server directly:

```bash
# Test the STDIO interface with Phase 2 features
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/unified-server.js --mode=stdio
```

Should return the list of 3 tools: `search_weather`, `find_location`, `get_weather_advice`.

```bash
# Test Phase 2 demo features
npm run demo:phase2
# Should show comprehensive Phase 2 testing results
```

## 🎉 What Phase 4.1 Claude Desktop Testing Proves

When working in Claude Desktop with Phase 4.1, you'll have confirmed:

1. **✅ Real Weather Data Integration** - search_weather tool returns actual weather information
2. **✅ Complete Data Pipeline** - Query → Parser → Router → WeatherService → Formatted Response
3. **✅ Rich Data Formatting** - Current conditions, daily forecast, hourly forecast all formatted
4. **✅ Multi-language Processing** - Chinese, English, Japanese queries handled correctly
5. **✅ Cache Integration** - Weather data caching for improved performance
6. **✅ Error Recovery** - Graceful fallback to mock data when APIs unavailable
7. **✅ Production Response Format** - User-friendly weather information display

### Phase 4.1 Features Working:
- **🌤️ Weather Data**: Real current conditions with all metrics
- **📅 Forecast Data**: Multi-day forecasts with temperatures and conditions
- **⏰ Hourly Data**: Hour-by-hour weather predictions
- **🌍 Location Resolution**: Automatic location detection from queries
- **💾 Smart Caching**: Differentiated TTL for different data types
- **📊 Metadata Display**: Shows data source, confidence, API used

This confirms Phase 4.1 has successfully integrated **real weather data** into the MCP tool!