# Smart Weather MCP Server - 測試套件

## 測試結構

```
tests/
├── unit/                    # 單元測試
│   ├── core/               # 核心元件測試
│   │   ├── express-server.test.ts
│   │   └── mcp-server.test.ts
│   ├── services/           # 服務層測試
│   │   ├── cache-mechanism.test.ts
│   │   ├── gemini-parser.test.ts
│   │   ├── google-maps-client.test.ts
│   │   ├── location-service.test.ts
│   │   ├── secret-manager.test.ts
│   │   ├── unicode-validation.test.ts
│   │   └── weather-service.test.ts
│   └── tools/              # MCP 工具測試
│       └── tool-handlers.test.ts
├── integration/            # 整合測試
│   ├── dual-transport.test.ts
│   ├── phase3-integration.test.ts
│   ├── phase4.2-comprehensive.test.ts
│   ├── query-parsing-integration.test.ts
│   ├── query-router-hybrid.test.ts
│   └── weather-api-integration.test.ts
├── e2e/                   # 端到端測試 (預留)
├── basic.test.js          # Jest 設置驗證
├── setup.js              # 測試設置
└── test-mcp-client.js    # 手動 MCP 客戶端測試
```

## 測試類型說明

### 單元測試 (Unit Tests)
- **core/**: MCP 伺服器核心、Express 伺服器
- **services/**: 各種服務層組件 (Gemini 解析、天氣 API、位置服務等)
- **tools/**: MCP 工具處理器

### 整合測試 (Integration Tests)  
- **API 整合**: Google Weather API、Google Maps API
- **跨服務整合**: 查詢路由、解析器協作
- **傳輸模式**: STDIO 和 HTTP/SSE 雙模式
- **階段功能**: Phase 3, Phase 4.2 綜合功能測試

### 手動測試工具
- **test-mcp-client.js**: 模擬 Claude Desktop 的 MCP 客戶端測試

## 運行測試

```bash
# 運行所有測試
npm test

# 運行特定類型的測試
npm test tests/unit/
npm test tests/integration/

# 運行特定測試檔案
npm test tests/unit/services/weather-service.test.ts

# 手動 MCP 客戶端測試
node tests/test-mcp-client.js
```

## 測試覆蓋重點

### Phase 4.2 功能驗證
- ✅ **search_weather**: 真實 Google Weather API 整合
- ✅ **find_location**: LocationService + Google Maps 整合  
- ✅ **get_weather_advice**: GeminiWeatherAdvisor + 規則 fallback

### 多語言支援
- ✅ 繁體中文 (zh-TW) 查詢與回應
- ✅ 英文 (en) 查詢與回應
- ✅ 日文 (ja) 基本支援

### 錯誤處理與降級
- ✅ API 不可用時的友善錯誤訊息
- ✅ Gemini AI 不可用時的規則 fallback
- ✅ 輸入驗證與安全性過濾

### MCP 設計哲學合規性
- ✅ 3 工具限制
- ✅ 統一參數結構 (query + context)
- ✅ 用戶中心的工具命名
- ✅ 可行動的建議輸出

## 測試數據

截至 2025-08-07：
- **總測試檔案**: 15 個
- **單元測試**: 8 個
- **整合測試**: 6 個  
- **手動測試**: 1 個
- **測試覆蓋率**: >80% (目標)

## 清理記錄

已清理的臨時檔案：
- ❌ `debug-*.ts` - 開發期間的 debug 腳本
- ❌ `test-*.ts` - 根目錄的臨時測試檔案
- ❌ `examples/` - 過時的 demo 檔案
- ❌ `scripts/quick-test.js` - 快速測試腳本
- ❌ 重複的 Phase 4 測試檔案

保留的有用檔案：
- ✅ `test-mcp-client.js` - 手動 MCP 測試工具
- ✅ `basic.test.js` - Jest 設置驗證
- ✅ 所有正式的測試套件
