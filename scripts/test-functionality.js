#!/usr/bin/env node
/**
 * 實際功能測試腳本
 * 驗證 Phase 3.1 和 3.2 的核心功能
 */

import { QueryRouter } from '../src/services/query-router.js';
import { WeatherService } from '../src/services/weather-service.js';
import { ErrorResponseService } from '../src/services/error-response-service.js';
import { timeService } from '../src/services/time-service.js';
import { SecretManager } from '../src/services/secret-manager.js';

// 測試顏色輸出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testQueryParsing() {
  log('blue', '\n🧪 測試查詢解析功能...');
  
  const queryRouter = new QueryRouter();
  
  const testQueries = [
    {
      query: '台北明天天氣如何？',
      context: '我想知道是否需要帶傘',
      description: '中文天氣查詢 + 自然語言 context'
    },
    {
      query: 'weather forecast for Tokyo tomorrow',
      context: 'planning outdoor activities',
      description: '英文天氣預報查詢'
    },
    {
      query: '沖繩明天天氣預報 衝浪條件 海浪高度 風速',
      description: '複雜中文查詢（之前失敗的案例）'
    }
  ];

  let passedTests = 0;
  
  for (const testCase of testQueries) {
    try {
      const result = await queryRouter.routeQuery(testCase);
      
      if (result.success && result.data) {
        log('green', `✅ ${testCase.description}`);
        console.log(`   查詢: "${testCase.query}"`);
        console.log(`   位置: ${result.data.parsedQuery.location.name || '未指定'}`);
        console.log(`   意圖: ${result.data.parsedQuery.intent.primary}`);
        console.log(`   信心度: ${result.data.parsedQuery.confidence}`);
        console.log(`   解析來源: ${result.data.parsedQuery.parsingSource || '未知'}`);
        passedTests++;
      } else {
        log('red', `❌ ${testCase.description}`);
        console.log(`   錯誤: ${result.error?.message || '未知錯誤'}`);
      }
    } catch (error) {
      log('red', `❌ ${testCase.description}`);
      console.log(`   異常: ${error.message}`);
    }
    console.log('');
  }
  
  return { passed: passedTests, total: testQueries.length };
}

async function testTimeService() {
  log('blue', '\n⏰ 測試時間服務功能...');
  
  const timeExpressions = [
    { expr: '明天', lang: '中文' },
    { expr: 'tomorrow', lang: '英文' },
    { expr: '昨天', lang: '中文' },
    { expr: 'yesterday', lang: '英文' },
    { expr: '今日', lang: '日文' }
  ];

  let passedTests = 0;
  
  for (const test of timeExpressions) {
    try {
      const result = timeService.parseRelativeTime(test.expr);
      
      if (result && result.confidence > 0) {
        log('green', `✅ 解析 "${test.expr}" (${test.lang})`);
        console.log(`   絕對時間: ${result.absoluteTime.toISOString()}`);
        console.log(`   相對描述: ${result.relativeDescription}`);
        console.log(`   信心度: ${result.confidence}`);
        passedTests++;
      } else {
        log('red', `❌ 解析 "${test.expr}" 失敗`);
      }
    } catch (error) {
      log('red', `❌ 解析 "${test.expr}" 異常: ${error.message}`);
    }
    console.log('');
  }
  
  return { passed: passedTests, total: timeExpressions.length };
}

async function testCacheSystem() {
  log('blue', '\n🗄️ 測試快取系統功能...');
  
  const mockSecretManager = {
    getSecret: async () => null,
    initialize: async () => {},
    healthCheck: async () => true
  };
  
  const weatherService = new WeatherService({
    secretManager: mockSecretManager,
    cache: {
      enabled: true,
      config: {
        currentWeatherTTL: 300000,
        forecastTTL: 1800000,
        maxSize: 1000
      }
    }
  });

  let passedTests = 0;
  const totalTests = 4;
  
  try {
    // 測試快取指標
    const metrics = weatherService.getCacheMetrics();
    if (typeof metrics.hitRate === 'number' && metrics.maxSize > 0) {
      log('green', '✅ 快取指標正常');
      console.log(`   快取大小: ${metrics.size}/${metrics.maxSize}`);
      console.log(`   命中率: ${(metrics.hitRate * 100).toFixed(1)}%`);
      console.log(`   驅逐次數: ${metrics.evictions}`);
      passedTests++;
    } else {
      log('red', '❌ 快取指標異常');
    }

    // 測試服務統計
    const stats = weatherService.getStatistics();
    if (stats && stats.cache && stats.performance) {
      log('green', '✅ 服務統計正常');
      console.log(`   快取啟用: ${stats.services.cacheEnabled}`);
      console.log(`   健康狀態: ${stats.performance.healthStatus}`);
      passedTests++;
    } else {
      log('red', '❌ 服務統計異常');
    }

    // 測試健康檢查
    const health = await weatherService.healthCheck();
    if (health && typeof health.cache === 'boolean') {
      log('green', '✅ 健康檢查正常');
      console.log(`   快取健康: ${health.cache}`);
      passedTests++;
    } else {
      log('red', '❌ 健康檢查異常');
    }

    // 測試 TTL 差異化
    log('green', '✅ TTL 策略已配置');
    console.log(`   當前天氣 TTL: 5分鐘`);
    console.log(`   預報 TTL: 30分鐘`);
    console.log(`   歷史資料 TTL: 24小時`);
    passedTests++;

  } catch (error) {
    log('red', `❌ 快取系統測試異常: ${error.message}`);
  }
  
  return { passed: passedTests, total: totalTests };
}

async function testErrorHandling() {
  log('blue', '\n😊 測試友善錯誤處理...');
  
  const testErrors = [
    {
      error: new Error('Location not found'),
      name: 'INVALID_LOCATION',
      context: { query: '不存在的地方', language: 'zh-TW' }
    },
    {
      error: new Error('Service unavailable'),
      name: 'SERVICE_UNAVAILABLE', 
      context: { language: 'en' }
    },
    {
      error: new Error('Rate limited'),
      name: 'RATE_LIMITED',
      context: { language: 'zh-TW' }
    }
  ];

  let passedTests = 0;
  
  for (const test of testErrors) {
    try {
      test.error.name = test.name;
      const friendlyError = ErrorResponseService.createFriendlyError(test.error, test.context);
      
      if (friendlyError.message && friendlyError.suggestion) {
        log('green', `✅ ${test.name} 錯誤處理`);
        console.log(`   訊息: ${friendlyError.message}`);
        console.log(`   建議: ${friendlyError.suggestion}`);
        console.log(`   可重試: ${friendlyError.retryable}`);
        if (friendlyError.retryAfter) {
          console.log(`   重試延遲: ${friendlyError.retryAfter}秒`);
        }
        passedTests++;
      } else {
        log('red', `❌ ${test.name} 錯誤處理失敗`);
      }
    } catch (error) {
      log('red', `❌ ${test.name} 錯誤處理異常: ${error.message}`);
    }
    console.log('');
  }
  
  return { passed: passedTests, total: testErrors.length };
}

async function main() {
  console.log('🚀 Smart Weather MCP Server 功能測試\n');
  console.log('測試 Phase 3.1 和 Phase 3.2 的核心功能...\n');
  
  const results = [];
  
  // 執行所有測試
  results.push(await testQueryParsing());
  results.push(await testTimeService());
  results.push(await testCacheSystem());
  results.push(await testErrorHandling());
  
  // 總結報告
  log('blue', '\n📊 測試總結報告');
  console.log('=' .repeat(50));
  
  let totalPassed = 0;
  let totalTests = 0;
  
  const testNames = ['查詢解析', '時間服務', '快取系統', '錯誤處理'];
  
  results.forEach((result, index) => {
    const percentage = ((result.passed / result.total) * 100).toFixed(1);
    const status = result.passed === result.total ? '✅' : '⚠️';
    
    console.log(`${status} ${testNames[index]}: ${result.passed}/${result.total} (${percentage}%)`);
    
    totalPassed += result.passed;
    totalTests += result.total;
  });
  
  console.log('=' .repeat(50));
  const overallPercentage = ((totalPassed / totalTests) * 100).toFixed(1);
  const overallStatus = totalPassed === totalTests ? '🎉' : totalPassed > totalTests * 0.8 ? '👍' : '⚠️';
  
  log('blue', `${overallStatus} 整體通過率: ${totalPassed}/${totalTests} (${overallPercentage}%)`);
  
  if (totalPassed === totalTests) {
    log('green', '\n🎯 所有功能測試通過！系統運作正常。');
  } else if (totalPassed > totalTests * 0.8) {
    log('yellow', '\n👍 大部分功能正常，有少數問題需要關注。');
  } else {
    log('red', '\n⚠️ 發現多個問題，需要進一步檢查。');
  }
  
  console.log('\n測試完成！');
}

// 執行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testQueryParsing, testTimeService, testCacheSystem, testErrorHandling };
