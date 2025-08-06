#!/usr/bin/env node
/**
 * 快速功能測試 - 使用編譯後的 dist 文件
 */

import { readFileSync } from 'fs';
import { spawn } from 'child_process';

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

async function testServerStartup() {
  log('blue', '🚀 測試伺服器啟動...');
  
  return new Promise((resolve) => {
    const server = spawn('node', ['dist/unified-server.js', '--mode=stdio'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let hasError = false;
    
    server.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    server.stderr.on('data', (data) => {
      const errorText = data.toString();
      if (errorText.includes('ERROR') || errorText.includes('Error')) {
        hasError = true;
      }
      output += errorText;
    });
    
    // 給伺服器 3 秒時間啟動
    setTimeout(() => {
      server.kill('SIGTERM');
      
      if (output.includes('Smart Weather MCP Server running') && !hasError) {
        log('green', '✅ 伺服器啟動成功');
        console.log('   模式: STDIO');
        console.log('   狀態: 運行中');
        resolve({ passed: 1, total: 1 });
      } else {
        log('red', '❌ 伺服器啟動失敗');
        if (hasError) {
          console.log('   發現錯誤:', output.split('\n').find(line => 
            line.includes('ERROR') || line.includes('Error')
          ));
        }
        resolve({ passed: 0, total: 1 });
      }
    }, 3000);
  });
}

async function testHTTPMode() {
  log('blue', '🌐 測試 HTTP 模式...');
  
  return new Promise((resolve) => {
    const server = spawn('node', ['dist/unified-server.js', '--mode=http', '--port=8080'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let hasError = false;
    
    server.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    server.stderr.on('data', (data) => {
      const errorText = data.toString();
      if (errorText.includes('ERROR') || errorText.includes('Error')) {
        hasError = true;
      }
      output += errorText;
    });
    
    // 給伺服器 3 秒時間啟動
    setTimeout(() => {
      server.kill('SIGTERM');
      
      if (output.includes('running on http') && !hasError) {
        log('green', '✅ HTTP 模式啟動成功');
        console.log('   模式: HTTP/SSE');
        console.log('   端口: 8080');
        resolve({ passed: 1, total: 1 });
      } else {
        log('red', '❌ HTTP 模式啟動失敗');
        resolve({ passed: 0, total: 1 });
      }
    }, 3000);
  });
}

async function testBuildStatus() {
  log('blue', '🔨 檢查構建狀態...');
  
  try {
    // 檢查關鍵檔案是否存在
    const keyFiles = [
      'dist/unified-server.js',
      'dist/services/weather-service.js',
      'dist/services/query-router.js',
      'dist/services/error-response-service.js'
    ];
    
    let existingFiles = 0;
    
    for (const file of keyFiles) {
      try {
        readFileSync(file);
        existingFiles++;
      } catch (error) {
        log('yellow', `⚠️ 缺少檔案: ${file}`);
      }
    }
    
    if (existingFiles === keyFiles.length) {
      log('green', '✅ 所有關鍵檔案存在');
      console.log(`   檢查檔案: ${existingFiles}/${keyFiles.length}`);
      return { passed: 1, total: 1 };
    } else {
      log('red', `❌ 缺少 ${keyFiles.length - existingFiles} 個關鍵檔案`);
      return { passed: 0, total: 1 };
    }
    
  } catch (error) {
    log('red', '❌ 構建檢查失敗:', error.message);
    return { passed: 0, total: 1 };
  }
}

async function testConfigFiles() {
  log('blue', '⚙️ 檢查配置檔案...');
  
  const configFiles = [
    'config/examples/claude_desktop_config.json',
    'package.json',
    'tsconfig.json'
  ];
  
  let validConfigs = 0;
  
  for (const file of configFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      if (file.endsWith('.json')) {
        JSON.parse(content); // 驗證 JSON 格式
      }
      validConfigs++;
    } catch (error) {
      log('yellow', `⚠️ 配置檔案問題: ${file} - ${error.message}`);
    }
  }
  
  if (validConfigs === configFiles.length) {
    log('green', '✅ 所有配置檔案正常');
    return { passed: 1, total: 1 };
  } else {
    log('red', `❌ ${configFiles.length - validConfigs} 個配置檔案有問題`);
    return { passed: 0, total: 1 };
  }
}

async function main() {
  console.log('🧪 Smart Weather MCP Server 快速功能測試\n');
  
  const results = [];
  
  // 執行測試
  results.push(await testBuildStatus());
  results.push(await testConfigFiles());
  results.push(await testServerStartup());
  results.push(await testHTTPMode());
  
  // 總結報告
  log('blue', '\n📊 快速測試總結');
  console.log('=' .repeat(40));
  
  let totalPassed = 0;
  let totalTests = 0;
  
  const testNames = ['構建狀態', '配置檔案', 'STDIO 模式', 'HTTP 模式'];
  
  results.forEach((result, index) => {
    const status = result.passed === result.total ? '✅' : '❌';
    console.log(`${status} ${testNames[index]}: ${result.passed}/${result.total}`);
    
    totalPassed += result.passed;
    totalTests += result.total;
  });
  
  console.log('=' .repeat(40));
  const overallPercentage = ((totalPassed / totalTests) * 100).toFixed(1);
  
  if (totalPassed === totalTests) {
    log('green', `🎉 所有基礎功能正常 (${overallPercentage}%)`);
  } else {
    log('yellow', `⚠️ ${totalTests - totalPassed} 個問題需要關注 (${overallPercentage}%)`);
  }
  
  // 給出建議
  console.log('\n💡 建議:');
  console.log('1. 運行 npm test 進行完整測試');
  console.log('2. 使用 Claude Desktop 進行實際功能測試');
  console.log('3. 檢查 Phase 3 整合測試結果');
  
  console.log('\n測試完成！');
}

main().catch(console.error);
