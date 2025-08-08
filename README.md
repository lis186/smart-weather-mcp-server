# Smart Weather MCP Server

🌤️ AI-powered weather queries for Claude Desktop and MCP clients

## What it does

Query weather in natural language through Claude Desktop or any MCP client. Supports Chinese, Japanese, and English.

**🟢 Production Ready** - Live at https://smart-weather-mcp-server-891745610397.asia-east1.run.app

## Quick Start

### Claude Desktop (Recommended)

```bash
npm install && npm run build
```

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "smart-weather": {
      "command": "node",
      "args": ["/path/to/dist/unified-server.js", "--mode=stdio"]
    }
  }
}
```

### Cloud Service

Use the hosted version via mcp-remote:

```json
{
  "smart-weather-cloud": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://smart-weather-mcp-server-891745610397.asia-east1.run.app/mcp"]
  }
}
```

## Features

- **Natural language queries**: "台北今天天氣" or "London weather tomorrow"
- **Multi-language support**: Chinese, Japanese, English
- **Real weather data**: Google Weather API integration
- **Smart caching**: 5min weather, 30min forecasts, 7-day locations
- **Dual deployment**: Local (STDIO) or Cloud (Streamable HTTP)

## Available Tools

### search_weather
Query current weather, forecasts, or historical data for any location.

### find_location  
Resolve ambiguous location names and get precise coordinates.

### get_weather_advice
Get personalized recommendations based on weather conditions.

## Development

```bash
# Install and build
npm install && npm run build

# Run tests
npm test

# Local development
npm run dev              # STDIO mode
npm run dev:http         # HTTP mode on port 8080

# Production
npm start                # Auto-detect mode
```

## Deployment

### Google Cloud Run

```bash
# Setup (one-time)
./scripts/setup-gcp-ci.sh
./scripts/setup-secrets.sh

# Deploy
./scripts/deploy-cloudrun.sh
```

Auto-deploys on push to main branch.

### Docker

```bash
npm run docker:build
npm run docker:run
```

## API Endpoints

- `/health` - Health check
- `/mcp` - MCP client connections
- `/` - Service info

## Architecture

Built with TypeScript, Express.js, and Google Cloud Platform. Uses hybrid rule-based + AI parsing for optimal performance.

## Documentation

- [Setup Guide](docs/setup/CLAUDE_DESKTOP_SETUP.md)
- [Deployment Guide](docs/setup/DEPLOYMENT.md)  
- [Technical Specs](docs/architecture/spec.md)

## License

MIT
