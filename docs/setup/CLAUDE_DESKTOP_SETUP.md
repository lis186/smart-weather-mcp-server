# 🖥️ Claude Desktop Integration Guide - Phase 4.1 with Enhanced Error Handling

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

## 🚀 使用 Cloud Run 部署版本 (Phase 5.1+ ✅ WORKING)

Phase 5.1 完成後，您可以選擇使用已部署到 Google Cloud Run 的版本，無需本地環境設定。

### Cloud Run 版本配置

在 Claude Desktop 配置文件中添加：

```json
{
  "mcpServers": {
    "smart-weather-cloud": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://smart-weather-mcp-server-891745610397.asia-east1.run.app/mcp"
      ]
    }
  }
}
```

### Cloud Run 版本優勢

- ✅ **無需本地環境** - 無需安裝 Node.js 或建置專案
- ✅ **自動更新** - 透過 CI/CD 自動部署最新版本
- ✅ **高可用性** - Google Cloud Run 99.95% SLA
- ✅ **完整 Secret Manager** - API Keys 安全管理
- ✅ **生產級效能** - 最佳化的容器環境

### 本地 vs Cloud Run 版本選擇

| 特性 | 本地版本 | Cloud Run 版本 |
|------|----------|----------------|
| 設定複雜度 | 需要本地環境設定 | 僅需配置檔案 |
| API Keys | 需要本地 .env 檔案 | 自動從 Secret Manager 載入 |
| 更新方式 | 手動 git pull | 自動 CI/CD 部署 |
| 網路需求 | 本地運行 | 需要網際網路連線 |
| 適用場景 | 開發測試 | 生產使用 |

**建議**: 日常使用選擇 **Cloud Run 版本**，開發測試時使用本地版本。