# 🖥️ Claude Desktop Integration Guide - Phase 2 Testing

## Step-by-Step Setup

### 1. Ensure Your Server is Built
```bash
npm run build
```

### 2. Configure Claude Desktop

**Location of config file:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration content** (Phase 2 Updated):
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

### 4. Test Phase 2 Features in Claude Desktop

Open Claude Desktop and try these **Phase 2** test queries to verify the new natural language processing and routing capabilities:

#### Test 1: English Current Weather Query
```
Use the smart-weather MCP server: What is the weather like in Tokyo today?
```

**Expected response**: Should use the `search_weather` tool with intelligent parsing showing:
- Detected location: Tokyo
- Intent: current weather
- Language: English

#### Test 2: Chinese Weather Forecast Query
```
Use the smart-weather server: 明天北京的天氣如何？
```

**Expected response**: Should use the `search_weather` tool with multilingual parsing showing:
- Detected location: Beijing (北京)
- Intent: weather forecast
- Language: Chinese

#### Test 3: Japanese Weather Query
```
Use the smart-weather server: 今日の東京の天気はどうですか？
```

**Expected response**: Should demonstrate Japanese language parsing:
- Detected location: Tokyo (東京)
- Intent: current weather
- Language: Japanese

#### Test 4: Weather Advice Intent
```
Ask the smart-weather server: Should I bring an umbrella for a walk in London today?
```

**Expected response**: Should use the `get_weather_advice` tool with intent classification:
- Intent: weather advice
- Weather metrics: precipitation
- Activity context: outdoor walk

#### Test 5: Location Search Intent
```
Use the smart-weather server to find weather stations near Paris, France
```

**Expected response**: Should use the `find_location` tool with location search intent.

### 5. Phase 2 Verification Signs

✅ **Phase 2 Success indicators:**
- Claude Desktop shows the MCP server as connected
- Tool calls show **intelligent parsing results** (not just placeholders)
- **Multilingual queries** are parsed correctly (English, Chinese, Japanese)
- **Intent classification** works (current weather, forecast, advice, location search)
- **Location extraction** from natural language queries
- Error handling provides **user-friendly suggestions**
- No connection failures or parsing errors

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

## 🎉 What Phase 2 Claude Desktop Testing Proves

When working in Claude Desktop with Phase 2, you'll have confirmed:

1. **✅ Phase 2 MCP Server Integration** - Unified server connects to Claude Desktop
2. **✅ Advanced Tool Registration** - All 3 tools with Phase 2 intelligence
3. **✅ Multilingual Natural Language Processing** - English, Chinese, Japanese support
4. **✅ Intelligent Query Routing** - AI-powered intent classification and location extraction
5. **✅ Error Handling & User Feedback** - Comprehensive error handling with suggestions
6. **✅ Performance Optimization** - Sub-second response times with caching
7. **✅ Gemini AI Integration** - Google Vertex AI parsing (if credentials configured)

### Phase 2 Features Working:
- **🤖 Gemini AI Parser**: Natural language understanding with multilingual support
- **🗺️ Query Router**: Intelligent routing with multi-criteria API selection  
- **🚨 Error Handler**: User-friendly error messages with actionable suggestions
- **⚡ Performance**: Caching and optimization for production use
- **🔒 Security**: Google Cloud Secret Manager integration

This confirms Phase 2 is **production-ready** for Phase 3 Google Weather API integration!