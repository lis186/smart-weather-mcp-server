# MCP 設計哲學（Storefront 版）

設計給使用者，不是給 API。工具數量精簡（3–4 個），名稱反映「用戶意圖」而非技術實作；所有工具統一 `query` + `context`（皆為純文字）參數；回應同時服務機器與人類（JSON + 可讀文本），並提供可行動的下一步建議。

---

## 核心原則（Spartan）

- **用戶中心工具設計**：名稱回答「用戶要做什麼」，而非「呼叫哪個端點」。
- **最小工具集**：最多 3–4 個工具，避免以資料型別或端點切割。
- **統一參數結構**：僅允許 `{ query: string, context?: string }`，禁止結構化參數（如 `location`, `units`）。
- **語義化動詞命名**：`search_*`、`find_*`、`get_*`、`update_*` 等。
- **商業價值導向**：工具解決真實任務，輸出包含「下一步建議」。
- **工具協作**：形成完整的用戶旅程（Discovery → Action → Confirmation）。
- **雙受眾輸出**：同時提供機器可解析（JSON）與人類可讀（Markdown/文字）內容。

---

## 工具定義模板

```json
{
  "name": "action_subject",
  "description": "Help users [specific user goal] by [clear value proposition]",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language description of what user wants"
      },
      "context": {
        "type": "string",
        "description": "Additional preferences, constraints, or conversation context (optional)"
      }
    },
    "required": ["query"]
  }
}
```

---

## 回應格式規範

- **可行動建議**：回應需包含建議或下一步；避免僅回傳原始資料。
- **雙格式輸出**：
  - 機器可讀：將結構化資料以 JSON 字串形式輸出。
  - 人類可讀：提供層次化文字（支援 Markdown）。

```ts
// 工具回應（示例）
return {
  content: [
    { type: 'text', text: JSON.stringify(data, null, 2) },
    { type: 'text', text: humanReadableText }
  ]
};
```

---

## 命名與數量規範

- **命名**：
  - ✅ `search_weather`, `find_location`, `get_advice`
  - ❌ `get_current_weather`, `call_weather_api`, `fetch_data`
- **數量**：
  - 最多 3–4 個，覆蓋完整用戶旅程即可；嚴禁以端點或資料型別拆分多工具。

---

## 工具協作設計

```text
User Need → Tool 1 (Discovery: search_*) → Tool 2 (Action: get_/update_*) → Tool 3 (Confirmation: get_*)
```

- 工具間資料與語義應自然流轉，避免孤立工具。
- 回應應指引「下一步可用工具」。

---

## 驗收清單（Code Review Checklist）

- [ ] 工具名稱反映用戶意圖，無技術實作字眼。
- [ ] 工具總數 ≤ 4，無端點/資料型別導向拆分。
- [ ] 所有工具皆使用 `query` + `context` 字串參數，無結構化欄位。
- [ ] 回應包含可行動建議與雙格式（JSON + 可讀文本）。
- [ ] 工具間形成完整用戶旅程，非孤立操作。
- [ ] 錯誤訊息一致、無多餘術語、指向可行解法。
- [ ] 支援自然語言查詢，無需了解底層 API。

---

## 反模式（Anti-Patterns）

- **技術函數拆分**：為每個 API 端點/資料型別建立獨立工具。
- **參數不一致**：混用結構化參數與 `query+context`。
- **實作導向命名**：名稱暴露內部架構或產品名。
- **資料-only 回應**：缺少建議、無人能直接採取行動。

---

## 範例

### ✅ Good（通用）

```ts
// 以用戶意圖命名，3 工具覆蓋完整旅程
tools = [
  'search_weather',     // 發現/查找天氣資訊
  'find_location',      // 定位/消歧地點
  'get_weather_advice'  // 取得行動建議
];
```

### ❌ Bad（技術導向）

```ts
// 以端點/資料型別切割，冗餘且不以用戶為中心
tools = [
  'get_current_conditions',
  'get_daily_forecast',
  'get_hourly_forecast',
  'get_historical_data',
  'geocode_location'
];
```

---

## 方針總結

> 設計給使用者、不是給 API。工具解決問題，而不只是存取資料。每個回合都應像與助理對話：清晰、可行、連貫。
