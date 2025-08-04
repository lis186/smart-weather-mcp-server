# 🖥️ Claude Desktop Integration Guide

## Step-by-Step Setup

### 1. Ensure Your Server is Built
```bash
npm run build
```

### 2. Configure Claude Desktop

**Location of config file:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration content** (already copied for you):
```json
{
  "mcpServers": {
    "smart-weather": {
      "command": "node",
      "args": [
        "/Users/justinlee/dev/smart-weather-mcp-server/worktrees/phase1/dist/mcp-stdio.js"
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

### 4. Test in Claude Desktop

Open Claude Desktop and try these test queries:

#### Test 1: Basic Weather Search
```
Use the smart-weather MCP server to search for weather in Tokyo
```

**Expected response**: Should use the `search_weather` tool and return a placeholder response like:
```
Weather search placeholder - Query: "weather in Tokyo"
```

#### Test 2: Location Finding
```
Use the smart-weather server to find the location "Paris France"
```

**Expected response**: Should use the `find_location` tool.

#### Test 3: Weather Advice
```
Ask the smart-weather server if I should bring an umbrella for a walk in London
```

**Expected response**: Should use the `get_weather_advice` tool.

### 5. Verification Signs

✅ **Success indicators:**
- Claude Desktop shows the MCP server as connected
- You can see tool calls being made
- Responses include placeholder text showing the tools are working
- No error messages about connection failures

❌ **Troubleshooting if it doesn't work:**

1. **Check Claude Desktop logs** (if available)
2. **Verify file paths** in the config are correct
3. **Test manually**:
   ```bash
   node dist/mcp-stdio.js
   # Should show: "Smart Weather MCP Server running on stdio"
   ```
4. **Restart Claude Desktop** completely after config changes

### 6. Manual Testing

You can also test the MCP server directly:

```bash
# Test the STDIO interface
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/mcp-stdio.js
```

Should return the list of 3 tools: `search_weather`, `find_location`, `get_weather_advice`.

## 🎉 What This Proves

When working in Claude Desktop, you'll have confirmed:

1. **✅ MCP Server Integration** - Your server connects to Claude Desktop
2. **✅ Tool Registration** - All 3 tools are available
3. **✅ Parameter Passing** - Query and context parameters work
4. **✅ Secret Loading** - Environment variables are loaded correctly
5. **✅ Phase 1 Complete** - Ready for Phase 2 (Gemini AI integration)

The placeholder responses prove the MCP framework is working correctly. In Phase 2, we'll replace these placeholders with actual Gemini AI processing and weather API calls!