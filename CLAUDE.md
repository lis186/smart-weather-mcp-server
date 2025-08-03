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

### 📋 執行計劃與進度追蹤

- **主要執行計劃**: `plan.md` - 包含 5 階段詳細實作計劃
- **學習日誌**: `LEARNING_LOG.md` - 記錄技術決策和實作經驗
- **目前階段**: 尚未開始實作階段
- **下一步**: 開始階段 1 - 基礎架構建立

### Existing Files

- `package.json` - Basic project configuration with dependencies
- `README.md` - Comprehensive project documentation
- `prd.md` - Product requirements document  
- `spec.md` - Technical specifications
- `plan.md` - **詳細執行計劃（必讀）**
- `.cursor/rules/` - Code philosophy, development principles, and commit standards

### Implementation Guidance

**⚠️ 實作時必須參考並持續更新 `plan.md` 中的進度**

`plan.md` 包含：
- 基於 development-principles.mdc 制定的階段性執行計劃
- 關鍵風險識別和緩解策略
- 具體的驗收標準和監控指標
- 每個階段的預期挑戰和驗證方式

### Implementation Steps (參考 plan.md 階段規劃)

**階段 1: 核心基礎建設** (關鍵風險優先)
1. 建立專案結構和 TypeScript 配置
2. 實現 MCP Server 基礎框架
3. 整合 Secret Manager

**階段 2: Gemini AI 解析核心** (關鍵風險優先)  
4. 實現 Gemini AI 查詢解析
5. 建立智能路由器

**階段 3-5: 參考 plan.md 完整階段規劃**

### Progress Tracking

實作過程中：
1. **更新 plan.md 中的核取方塊** - 標記完成的任務
2. **記錄學習要點** - 在 plan.md 相應章節記錄遇到的技術難題和解決方案
3. **調整時間預估** - 根據實際情況更新後續階段預估
4. **更新風險評估** - 發現新風險時更新 plan.md 風險管理章節

## MCP Server Usage Guidelines

When working on this project, use these specific MCP servers for their designated purposes:

### 🧠 clear-thought - Complex Problem Solving

- **When to use**: For thinking through and solving complex problems
- **Purpose**: Structured analysis of difficult technical challenges
- **Use cases**:
  - Complex architectural decisions (e.g., Gemini AI integration patterns)
  - Debugging difficult issues
  - Planning multi-step implementations
  - Analyzing trade-offs between different approaches
  - Breaking down complex problems into manageable parts

### 🕒 server-time - Time Queries

- **When to use**: Whenever you need current time, date, or timezone information
- **Configuration**: Asia/Taipei timezone
- **Purpose**: Replace manual time assumptions with accurate current time data

### 🔄 n8n-mcp - Workflow Management  

- **When to use**: Creating, updating, and running workflows on n8n
- **Purpose**: Manage n8n workflows programmatically
- **Use cases**: Setting up automation workflows, testing MCP integrations, workflow deployment

### ☁️ cloud-run - Deployment & Testing

- **When to use**: Deploy and test our Smart Weather MCP server
- **Purpose**: Google Cloud Run deployment management
- **Use cases**: Deploy containers, manage services, test Cloud Run deployments, monitor Smart Weather MCP server

### Additional Available Servers

- **hackmd**: For HackMD document management and collaboration
- **notionApi**: For Notion integration tasks and documentation

### 🐙 GitHub CLI (gh) - GitHub Operations

- **When to use**: For all GitHub-related operations
- **Purpose**: Manage GitHub repositories, issues, pull requests, releases
- **Use cases**:
  - Creating and managing pull requests
  - Working with GitHub issues
  - Managing releases and tags
  - Repository operations and settings
  - GitHub Actions workflow management
- **Examples**: `gh pr create`, `gh issue list`, `gh repo view`, `gh release create`

## Working with This Repository

### Implementation Guidelines

**IMPORTANT**: 實作時必須參考並持續更新 `plan.md` 中的進度追蹤。

#### 階段性實作步驟

1. **開始新階段前**：
   - 檢視 `plan.md` 中的階段目標和驗收標準
   - 更新階段狀態為 "🔄 進行中"
   - 確認關鍵風險和緩解策略

2. **實作過程中**：
   - 遵循 development-principles.mdc 中的原則
   - 記錄重要技術發現到 `LEARNING_LOG.md`
   - 遇到阻礙時及時調整計劃
   - 保持小批次開發和快速驗證

3. **階段完成後**：
   - 更新 `plan.md` 中的階段狀態為 "✅ 已完成"
   - 記錄關鍵學習要點和計劃調整
   - 評估對後續階段的影響
   - 更新下階段準備事項

#### 進度追蹤機制

每個里程碑完成後，Claude 必須：
1. 更新 `plan.md` 中對應的進度狀態
2. 在 `LEARNING_LOG.md` 記錄技術決策和發現
3. 識別影響後續階段的關鍵學習
4. 主動調整計劃以反映新的理解

#### 實作優先順序

基於 development-principles.mdc：
1. **快速部署優先** - 每階段都要能獨立部署驗證
2. **關鍵風險優先** - 優先處理技術可行性驗證
3. **小批次開發** - 保持功能增量可驗證
4. **持續學習** - 記錄並應用每階段的學習成果

### When Adding New Features

1. 檢查 `plan.md` 確認功能是否在計劃範圍內
2. Use TodoWrite tool to plan implementation steps
3. Follow the 3-tool limit from MCP design philosophy
4. Ensure all tools use `query` + `context` parameters  
5. Test in actual Cloud Run environment, not just locally
6. Run lint/typecheck commands if they exist
7. 更新 `plan.md` 和 `LEARNING_LOG.md` 記錄進度

### When Making Changes

1. Read existing documentation first to understand the vision
2. 參考 `plan.md` 中的當前階段目標
3. Follow the development principles for speed and validation
4. Keep changes small and deployable
5. Update documentation if architecture changes
6. Test Cloud Run deployment after significant changes
7. 記錄重要決策和學習要點

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
