# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Smart Weather MCP Server designed for Google Cloud Run deployment. The project follows the Shopify Storefront MCP design philosophy with user-intent-driven tools, using TypeScript and Node.js to provide intelligent weather querying capabilities through AI-powered natural language understanding.

## Essential Commands

### Development Commands
- `npm run dev` - Start development server with tsx
- `npm run build` - Build TypeScript to dist/
- `npm start` - Run built application from dist/
- `npm test` - Run Jest tests

### Docker Commands  
- `npm run docker:build` - Build Docker container
- `npm run docker:run` - Run container locally on port 8080

### Cloud Run Deployment
```bash
# Build and deploy to Google Cloud Run
gcloud builds submit --tag gcr.io/PROJECT_ID/smart-weather-mcp
gcloud run deploy smart-weather-mcp --image gcr.io/PROJECT_ID/smart-weather-mcp --region asia-east1 --port 8080
```

## Architecture Overview

This is a **planned but not yet implemented** MCP server with the following intended architecture:

### Core Design Principles
- **3 User-Intent Tools**: Following Storefront MCP philosophy limiting to 3-4 tools maximum
- **Unified Parameter Structure**: All tools use `query` + `context` parameters only
- **User-Centric Naming**: Tool names reflect user intent, not technical implementation
- **AI-Powered Parsing**: Uses Gemini 2.5 Flash-Lite for natural language understanding

### Planned Tool Structure
1. **`search_weather`** - Intelligent weather querying (current/forecast/historical)
2. **`find_location`** - Location discovery and confirmation  
3. **`get_weather_advice`** - Personalized weather recommendations

### Technology Stack
- **Runtime**: Node.js 18+ in Google Cloud Run containers
- **Language**: TypeScript 5.0+
- **MCP SDK**: @modelcontextprotocol/sdk v1.17.1
- **HTTP Server**: Express.js for Cloud Run HTTP endpoints
- **AI Parser**: Google Gemini 2.5 Flash-Lite via Vertex AI
- **Weather API**: Google Maps Platform Weather API
- **Transport**: HTTP/SSE only (no STDIO support)

### Cloud Run Specific Features
- **Health Check Endpoint**: `/health` for Cloud Run monitoring
- **SSE Transport**: `/sse` for MCP client connections  
- **Secret Manager**: Secure API key management
- **Auto-scaling**: 0 to N instances based on demand

## Development Principles

### MCP Design Philosophy (from .cursor/rules/mcp-design-philosophy.mdc)
- **User-Centric Tool Design**: Tool names must reflect user intent, not technical implementation
- **Minimal Tool Count**: Maximum 3-4 tools per MCP server
- **Unified Parameter Structure**: ALL tools MUST use `query` + `context` pattern
- **Business Value Orientation**: Every tool must solve a real user problem
- **Tools must work together in logical user journeys**

### Development Speed & Delivery (from .cursor/rules/development-principles.mdc)
- **Deploy Fast First**: Deploy simple features first, iterate quickly
- **Small Batch Development**: Each step should be small and verifiable
- **Critical Risk First**: Validate critical parts earliest
- **Fail Fast Principle**: Fail fast, set time boxes for uncertain approaches
- **Continuous Validation**: Test in real Cloud Run + n8n environment, not just locally
- **Pragmatism Over Perfection**: "Working" is more important than "perfect"
- **Minimize Dependencies**: Don't add packages if not needed
- **Implementation Consistency**: Use same approaches for same problems

### Implementation Guidelines
- Always follow the same patterns for similar problems
- Use existing frameworks and libraries found in the codebase
- Document design decisions for future consistency
- If changing existing conventions, confirm with humans first
- Keep complexity under control - simple solutions that work beat complex perfect ones
- Validate assumptions early - don't build on unverified assumptions

## Git Commit Standards (from .cursor/rules/git-commit-message.mdc)
```
<type>(<scope>): <subject>

<body>
```
- Use imperative verbs: Add, Fix, Update, Remove
- Keep subject under 50 characters
- Write in English
- Include "why" not just "what" in description

## Current Project Status

⚠️ **IMPORTANT**: This repository contains planning documents but **NO SOURCE CODE YET**. The codebase structure outlined in the documentation is planned but not implemented.

### Existing Files
- `package.json` - Basic project configuration with dependencies
- `README.md` - Comprehensive project documentation
- `prd.md` - Product requirements document  
- `spec.md` - Technical specifications
- `DEVELOPMENT_PRINCIPLES.md` - Development methodology (now also in .cursor/rules/)
- `.cursor/rules/` - Code philosophy, development principles, and commit standards

### Next Steps for Implementation
1. Create `src/` directory structure
2. Implement Express server with Cloud Run health checks
3. Set up MCP SDK with SSE transport
4. Integrate Gemini AI for query parsing
5. Implement Google Weather API clients
6. Add caching and error handling
7. Create Dockerfile and deployment scripts

## Working with This Repository

### When Adding New Features
1. Use TodoWrite tool to plan implementation steps
2. Follow the 3-tool limit from MCP design philosophy
3. Ensure all tools use `query` + `context` parameters  
4. Test in actual Cloud Run environment, not just locally
5. Run lint/typecheck commands if they exist

### When Making Changes
1. Read existing documentation first to understand the vision
2. Follow the development principles for speed and validation
3. Keep changes small and deployable
4. Update documentation if architecture changes
5. Test Cloud Run deployment after significant changes

### Error Handling Strategy
- Use structured error types with user-friendly messages
- Map Google API errors to appropriate user responses
- Include actionable suggestions in error messages
- Log errors with sufficient context for debugging

### Performance Targets
- Average response time ≤ 1.5 seconds
- Gemini parsing time ≤ 500ms  
- Cache hit rate ≥ 60%
- API success rate ≥ 95%
- Cold start time ≤ 800ms for Cloud Run

This repository is designed to be a reference implementation of MCP server best practices with Google Cloud integration.