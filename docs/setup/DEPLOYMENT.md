# Smart Weather MCP Server 部署指南

本指南提供完整的 Google Cloud Run 部署流程，包含自動化 CI/CD 與手動部署選項。

## 📋 前置需求

- Google Cloud CLI (`gcloud`) 已安裝並認證
- Docker 已安裝
- GitHub CLI (`gh`) 已安裝（用於設定 Secrets）
- 具備 GCP 專案管理員權限

## 🎯 部署架構

```
GitHub Repository → GitHub Actions → Artifact Registry → Cloud Run
                                                      ↗
                                    Secret Manager ↗
```

### 專案配置

- **GCP Project**: `striped-history-467517-m3`
- **Project Number**: `891745610397`
- **Region**: `asia-east1`
- **Service Name**: `smart-weather-mcp-server`
- **Artifact Registry**: `asia-east1-docker.pkg.dev/striped-history-467517-m3/smart-weather-mcp-server`

## 🚀 一次性設定流程

### 1. GCP 基礎設定

執行自動化設定腳本：

```bash
# 設定 GCP 專案
gcloud config set project striped-history-467517-m3

# 執行 GCP CI/CD 設定
./scripts/setup-gcp-ci.sh
```

此腳本將：
- 啟用必要的 GCP APIs
- 建立 Artifact Registry 儲存庫
- 建立 Service Account 與必要權限
- 設定 Workload Identity Federation
- 輸出 GitHub Secrets 設定指令

### 2. Secret Manager 設定

```bash
# 建立 secrets 結構
./scripts/setup-secrets.sh

# 手動新增 API Keys（請替換成實際的 key）
echo 'YOUR_GEMINI_API_KEY' | gcloud secrets versions add gemini-api-key --data-file=- --project=striped-history-467517-m3
echo 'YOUR_WEATHER_API_KEY' | gcloud secrets versions add weather-api-key --data-file=- --project=striped-history-467517-m3
```

### 3. GitHub Secrets 設定

根據 `setup-gcp-ci.sh` 輸出，設定 GitHub repository secrets：

```bash
gh secret set WIF_PROVIDER --body "projects/891745610397/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
gh secret set WIF_SERVICE_ACCOUNT --body "github-ci-deployer@striped-history-467517-m3.iam.gserviceaccount.com"
```

## 🔄 部署方式

### 自動部署（推薦）

推送至 `main` 分支即自動觸發部署：

```bash
git push origin main
```

GitHub Actions 將自動：
1. 執行測試
2. 建置 Docker 映像
3. 推送至 Artifact Registry
4. 部署至 Cloud Run

### 手動部署

使用部署腳本：

```bash
# 建置並部署最新版本
./scripts/deploy-cloudrun.sh

# 部署指定映像 tag
./scripts/deploy-cloudrun.sh v1.2.3
```

### 直接使用 gcloud

```bash
# 建置映像
docker build -t asia-east1-docker.pkg.dev/striped-history-467517-m3/smart-weather-mcp-server/smart-weather-mcp-server:latest .

# 推送映像
docker push asia-east1-docker.pkg.dev/striped-history-467517-m3/smart-weather-mcp-server/smart-weather-mcp-server:latest

# 部署至 Cloud Run
gcloud run deploy smart-weather-mcp-server \
  --image=asia-east1-docker.pkg.dev/striped-history-467517-m3/smart-weather-mcp-server/smart-weather-mcp-server:latest \
  --region=asia-east1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=projects/891745610397/secrets/gemini-api-key:latest,WEATHER_API_KEY=projects/891745610397/secrets/weather-api-key:latest"
```

## ⚙️ Cloud Run 配置

### 資源配置（最省錢設定）

- **CPU**: 1 vCPU
- **Memory**: 512 MiB
- **Concurrency**: 80 requests per instance
- **Min instances**: 0 (冷啟動)
- **Max instances**: 10
- **Timeout**: 300 seconds

### 環境變數

自動注入的環境變數：
- `GEMINI_API_KEY`: 從 Secret Manager 載入
- `WEATHER_API_KEY`: 從 Secret Manager 載入
- `NODE_ENV`: production
- `PORT`: 8080
- `HOST`: 0.0.0.0

### 健康檢查

- **Health Check URL**: `/health`
- **Interval**: 30 seconds
- **Timeout**: 3 seconds
- **Start Period**: 5 seconds
- **Retries**: 3

## 🔍 監控與除錯

### 檢視部署狀態

```bash
# 查看服務詳情
gcloud run services describe smart-weather-mcp-server --region=asia-east1

# 檢視最新版本
gcloud run revisions list --service=smart-weather-mcp-server --region=asia-east1

# 查看流量分配
gcloud run services describe smart-weather-mcp-server --region=asia-east1 --format="table(spec.traffic[].revisionName,spec.traffic[].percent)"
```

### 檢視日誌

```bash
# 即時日誌
gcloud logs tail --follow --project=striped-history-467517-m3 --filter='resource.type=cloud_run_revision AND resource.labels.service_name=smart-weather-mcp-server'

# 最近 1 小時的日誌
gcloud logs read --project=striped-history-467517-m3 --filter='resource.type=cloud_run_revision AND resource.labels.service_name=smart-weather-mcp-server' --since=1h
```

### 測試部署

```bash
# 取得服務 URL
SERVICE_URL=$(gcloud run services describe smart-weather-mcp-server --region=asia-east1 --format="value(status.url)")

# 測試健康檢查
curl $SERVICE_URL/health

# 測試 MCP 連線（如果支援 HTTP 模式）
curl -H "Content-Type: application/json" $SERVICE_URL/sse
```

## 🚨 故障排除

### 常見問題

1. **部署失敗 - 權限不足**
   ```bash
   # 檢查 Service Account 權限
   gcloud projects get-iam-policy striped-history-467517-m3 --flatten="bindings[].members" --filter="bindings.members:github-ci-deployer@striped-history-467517-m3.iam.gserviceaccount.com"
   ```

2. **容器啟動失敗**
   ```bash
   # 檢查最新版本日誌
   gcloud logs read --project=striped-history-467517-m3 --filter='resource.type=cloud_run_revision' --limit=50
   ```

3. **Secret 載入失敗**
   ```bash
   # 檢查 secrets 是否存在
   gcloud secrets list --project=striped-history-467517-m3
   gcloud secrets versions list gemini-api-key --project=striped-history-467517-m3
   ```

4. **GitHub Actions 失敗**
   - 檢查 GitHub Secrets 是否正確設定
   - 確認 Workload Identity Federation 設定
   - 檢查 GitHub Actions 日誌

### 回滾部署

```bash
# 查看所有版本
gcloud run revisions list --service=smart-weather-mcp-server --region=asia-east1

# 回滾至前一版本
gcloud run services update-traffic smart-weather-mcp-server \
  --to-revisions=REVISION_NAME=100 \
  --region=asia-east1
```

## 💰 成本優化

目前配置針對最低成本優化：
- **Min instances**: 0（避免閒置費用）
- **CPU/Memory**: 最小可用配置
- **Concurrency**: 80（最大化單一實例處理能力）

預估成本（輕度使用）：
- **Request 費用**: 每月前 200 萬次免費
- **CPU 時間**: 每月前 18 萬 vCPU-秒免費
- **Memory**: 每月前 36 萬 GiB-秒免費
- **網路**: 每月前 1 GB 免費

## 🔒 安全最佳實踐

1. **Secrets 管理**: 所有敏感資料透過 Secret Manager
2. **最小權限**: Service Account 僅具備必要權限
3. **容器安全**: 使用 non-root user 執行
4. **網路**: 預設使用 HTTPS
5. **認證**: 可依需求啟用 IAM 認證

## 📚 相關資源

- [Google Cloud Run 文件](https://cloud.google.com/run/docs)
- [Artifact Registry 文件](https://cloud.google.com/artifact-registry/docs)
- [Secret Manager 文件](https://cloud.google.com/secret-manager/docs)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
