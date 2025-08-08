# 🚀 Transport Mode Switching Guide

The Smart Weather MCP Server supports multiple transport modes for different use cases. This guide explains how to switch between them.

## 🔄 Available Transport Modes

### 1. **STDIO Mode** (Default)

- **Purpose**: Claude Desktop integration, command-line MCP clients
- **Transport**: Standard Input/Output with JSON-RPC
- **Best for**: Claude Desktop, MCP CLI tools, desktop applications

### 2. **Streamable HTTP Mode**

- **Purpose**: Web applications, browser integration, n8n workflows
- **Transport**: Streamable HTTP (Server-Sent Events + POST messages)
- **Best for**: Web apps, REST APIs, workflow automation platforms

Note: For Phase 5.2 production validation, focus is on HTTP request/response and STDIO. See `docs/development/plan.md` Phase 5.2 section.

## 📋 **Quick Start Examples**

### Using NPM Scripts (Recommended)

```bash
# Development with different modes
npm run dev:stdio          # STDIO mode for Claude Desktop testing
npm run dev:http           # HTTP mode on port 8080

# Production with different modes  
npm run start:stdio        # STDIO mode (built)
npm run start:http         # HTTP mode (built)
npm run start:unified      # Unified server (defaults to STDIO)
```

### Using Direct Commands

```bash
# STDIO mode (default)
node dist/unified-server.js
node dist/unified-server.js --mode=stdio

# HTTP mode with default settings (0.0.0.0:8080)
node dist/unified-server.js --mode=http

# HTTP mode with custom host and port
node dist/unified-server.js --mode=http --host=localhost --port=3000

# Show help
node dist/unified-server.js --help
```

## ⚙️ **Configuration Examples**

### Claude Desktop Configuration

Update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "smart-weather": {
      "command": "node",
      "args": [
        "/path/to/smart-weather-mcp-server/dist/unified-server.js",
        "--mode=stdio"
      ],
      "env": {
        "NODE_ENV": "development",
        "GEMINI_API_KEY": "your-key",
        "WEATHER_API_KEY": "your-key"
      }
    }
  }
}
```

### Docker with Transport Mode

```dockerfile
# STDIO mode
CMD ["node", "dist/unified-server.js", "--mode=stdio"]

# HTTP mode
CMD ["node", "dist/unified-server.js", "--mode=http", "--port=8080"]
EXPOSE 8080
```

### Cloud Run Deployment

```bash
# HTTP mode for Cloud Run (required)
gcloud run deploy smart-weather-mcp \
  --image gcr.io/PROJECT_ID/smart-weather-mcp \
  --port 8080 \
  --set-env-vars "MODE=http,PORT=8080"
```

## 🔧 **Environment Variables**

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | No | `development` |
| `GEMINI_API_KEY` | Google Gemini API key | Yes* | - |
| `WEATHER_API_KEY` | Weather API key | Yes* | - |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | No | - |

*Required for full functionality, but server will start with warnings in development

## 🎯 **Use Case Matrix**

| Scenario | Recommended Mode | Command |
|----------|------------------|---------|
| **Claude Desktop Integration** | STDIO | `--mode=stdio` |
| **Local Development/Testing** | STDIO | `npm run dev:stdio` |
| **Web Application** | HTTP | `--mode=http --port=8080` |
| **n8n Workflow Integration** | HTTP | `--mode=http --host=0.0.0.0` |
| **Cloud Run Deployment** | HTTP | `--mode=http --port=8080` |
| **Docker Container** | HTTP | `--mode=http --host=0.0.0.0` |
| **API Testing (Postman/curl)** | HTTP | `--mode=http --port=3000` |

## 🔍 **Testing Different Modes**

### STDIO Mode Testing

```bash
# Test tool listing
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
  node dist/unified-server.js --mode=stdio

# Test weather search
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "search_weather", "arguments": {"query": "weather in Tokyo"}}}' | \
  node dist/unified-server.js --mode=stdio
```

### HTTP Mode Testing

```bash
# Start server in background
node dist/unified-server.js --mode=http --port=8080 &

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:8080/
curl http://localhost:8080/mcp  # Streamable HTTP endpoint for MCP clients
```

## 🚨 **Troubleshooting**

### Common Issues

**1. STDIO JSON Parsing Errors**

```
Unexpected token 'L', "Loading se"... is not valid JSON
```

- **Cause**: Debug logs going to stdout
- **Solution**: Logs are now redirected to stderr automatically

**2. HTTP Port Already in Use**

```
Error: listen EADDRINUSE :::8080
```

- **Solution**: Use different port: `--port=8081`

**3. Claude Desktop Not Recognizing Server**

```
Server failed to start
```

- **Check**: Absolute path in `claude_desktop_config.json`
- **Check**: File permissions: `chmod +x dist/unified-server.js`

### Debug Mode

```bash
# Enable debug logging (all modes)
DEBUG=* node dist/unified-server.js --mode=stdio

# HTTP mode with verbose logging
node dist/unified-server.js --mode=http --port=8080 2>&1 | grep -v "Loading secrets"
```

## 📈 **Performance Considerations**

| Mode | Startup Time | Memory Usage | Latency | Scalability |
|------|--------------|--------------|---------|-------------|
| **STDIO** | ~100ms | ~50MB | <10ms | Single client |
| **HTTP** | ~200ms | ~80MB | <50ms | Multiple clients |

## 🔄 **Migration Guide**

### From Separate Entry Points

**Old way:**

```bash
# Two separate files
node dist/mcp-stdio.js       # STDIO only
node dist/server.js          # HTTP only
```

**New way:**

```bash
# One unified server
node dist/unified-server.js --mode=stdio  # STDIO
node dist/unified-server.js --mode=http   # HTTP
```

### Updating Claude Desktop Config

**Before:**

```json
"args": ["/path/to/dist/mcp-stdio.js"]
```

**After:**

```json
"args": [
  "/path/to/dist/unified-server.js",
  "--mode=stdio"
]
```

## 🎉 **Benefits of Unified Server**

✅ **Single codebase** - Easier maintenance and debugging  
✅ **Consistent behavior** - Same MCP tools across all transport modes  
✅ **Flexible deployment** - Switch modes without code changes  
✅ **Better testing** - Test both modes with same server  
✅ **Clear documentation** - All transport options in one place  

---

**Next Steps**: After choosing your transport mode, you're ready to use the Smart Weather MCP Server with your preferred client or integration platform!
