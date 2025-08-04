# 專案維護指南

## 📁 檔案結構說明

### 重新組織後的結構

```
smart-weather-mcp-server/
├── src/                         # 源碼
│   ├── core/                    # 核心 MCP & Express 伺服器
│   │   ├── mcp-server.ts        # MCP 工具實現
│   │   └── express-server.ts    # HTTP/SSE 伺服器
│   ├── services/                # 外部服務
│   │   └── secret-manager.ts    # Secret Manager 客戶端
│   ├── types/                   # TypeScript 類型定義
│   │   └── index.ts
│   └── unified-server.ts        # 統一伺服器入口點
├── docs/                        # 所有文檔
│   ├── setup/                   # 設置指南
│   │   └── CLAUDE_DESKTOP_SETUP.md
│   ├── development/             # 開發指南
│   │   ├── TRANSPORT_MODES.md
│   │   ├── plan.md
│   │   └── LEARNING_LOG.md
│   ├── architecture/            # 架構文檔
│   │   └── spec.md
│   └── README.md                # 文檔索引
├── config/                      # 配置檔案
│   ├── examples/                # 範例配置
│   │   ├── claude_desktop_config.json
│   │   └── .env.example
│   ├── development/             # 開發配置
│   │   └── claude_desktop_config_merged.json
│   └── README.md                # 配置說明
├── tests/                       # 測試檔案
│   ├── test-mcp-client.js
│   └── test-phase1.js
├── scripts/                     # 構建和工具腳本 (預留)
└── [root files]                 # 必要根檔案
    ├── package.json
    ├── tsconfig.json
    ├── Dockerfile
    ├── README.md
    ├── CLAUDE.md
    └── prd.md
```

## 🔄 添加新功能

### 1. 源碼組織
- **核心功能**: 放在 `src/core/`
- **外部服務**: 放在 `src/services/` 
- **工具類**: 創建 `src/utils/` (如需要)
- **類型定義**: 添加到 `src/types/index.ts`

### 2. 文檔更新
- **設置指南**: 放在 `docs/setup/`
- **開發指南**: 放在 `docs/development/`
- **架構文檔**: 放在 `docs/architecture/`

### 3. 配置管理
- **範例配置**: 放在 `config/examples/`
- **開發配置**: 放在 `config/development/`

## 📝 維護清單

### 定期檢查項目

1. **依賴更新**
   ```bash
   npm audit
   npm outdated
   ```

2. **構建測試**
   ```bash
   npm run build
   npm test
   ```

3. **文檔同步**
   - 確保 README.md 路徑正確
   - 更新 CLAUDE.md 中的文檔索引
   - 檢查所有文檔連結有效性

### 添加新文檔時

1. 放在適當的 `docs/` 子目錄
2. 更新 `docs/README.md` 索引
3. 更新 `CLAUDE.md` 文檔索引
4. 在主 README.md 中添加連結

### 添加新配置時

1. 範例配置放在 `config/examples/`
2. 敏感配置放在 `config/development/`
3. 更新 `config/README.md`

## 🚀 部署維護

### 本地開發
```bash
npm run dev                    # 開發模式
npm run build && npm start    # 生產模式測試
```

### 傳輸模式切換
```bash
node dist/unified-server.js --mode=stdio     # Claude Desktop
node dist/unified-server.js --mode=http      # Web 客戶端
```

### Docker 部署
```bash
npm run docker:build
npm run docker:run
```

## 🔍 故障排除

### 常見問題

1. **TypeScript 編譯錯誤**
   - 檢查 `src/types/index.ts` 類型定義
   - 確認所有導入路徑正確

2. **文檔連結失效**
   - 檢查檔案是否在正確目錄
   - 更新所有相關文檔的連結

3. **配置檔案找不到**
   - 檢查 `config/` 目錄結構
   - 確認環境變數或 Secret Manager 設置

### 日誌查看
```bash
# 本地開發
npm run dev

# Docker 容器
docker logs [container-id]

# Google Cloud Run
gcloud logs read smart-weather-mcp
```