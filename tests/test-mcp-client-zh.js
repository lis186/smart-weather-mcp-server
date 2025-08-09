#!/usr/bin/env node

/**
 * 中文 STDIO 煙霧測試（台北 / 沖繩案例）
 * 目標：快速驗證三個 MCP 工具在 STDIO 模式下的雙格式輸出
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  console.log('🧪 中文 STDIO 煙霧測試開始...\n');

  // 啟動連線（由 StdioClientTransport 直接啟動目標指令）
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/unified-server.js', '--mode=stdio'],
    env: { NODE_ENV: 'development' },
  });

  const client = new Client({ name: 'zh-smoke-client', version: '1.0.0' }, { capabilities: {} });

  console.log('1. 連線至 MCP 伺服器...');
  await client.connect(transport);
  console.log('✅ 已連線');

  console.log('\n2. 取得工具列表...');
  const tools = await client.listTools();
  const toolNames = (tools.tools || []).map((t) => t.name);
  console.log(`✅ 工具：${toolNames.join(', ')}`);

  // 3. search_weather：台北今天天氣（規則為主的熱路徑）
  console.log('\n3. 測試 search_weather（台北）...');
  const taipei = await client.callTool({
    name: 'search_weather',
    arguments: { query: '台北今天天氣', context: '語言: zh-TW' },
  });
  console.log('✅ 回應：');
  taipei.content.forEach((c) => console.log(`   ${c.text}`));

  // 4. search_weather：沖繩複雜查詢（傾向觸發 AI 路徑）
  console.log('\n4. 測試 search_weather（沖繩複雜查詢）...');
  const okinawa = await client.callTool({
    name: 'search_weather',
    arguments: { query: '沖繩明天天氣預報 衝浪條件 海浪高度 風速', context: '語言: zh-TW' },
  });
  console.log('✅ 回應：');
  okinawa.content.forEach((c) => console.log(`   ${c.text}`));

  // 5. find_location：台北 101（地點搜尋）
  console.log('\n5. 測試 find_location（台北 101）...');
  const loc = await client.callTool({
    name: 'find_location',
    arguments: { query: '台北 101', context: '語言: zh-TW' },
  });
  console.log('✅ 回應：');
  loc.content.forEach((c) => console.log(`   ${c.text}`));

  // 6. get_weather_advice：是否帶傘（台北）
  console.log('\n6. 測試 get_weather_advice（台北 是否帶傘）...');
  const advice = await client.callTool({
    name: 'get_weather_advice',
    arguments: { query: '今天需要帶雨傘嗎？', context: '地點: 台北, 活動: 走路, 語言: zh-TW' },
  });
  console.log('✅ 回應：');
  advice.content.forEach((c) => console.log(`   ${c.text}`));

  await client.close();
  console.log('\n🎉 中文 STDIO 煙霧測試完成！');
}

main().catch((err) => {
  console.error('❌ 測試失敗：', err);
  process.exit(1);
});


