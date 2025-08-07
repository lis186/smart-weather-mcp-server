#!/usr/bin/env npx tsx

/**
 * Debug Location Patterns
 * Test individual regex patterns
 */

async function debugPatterns() {
  console.log('🔍 Debug Location Patterns\n');
  
  // Test individual patterns
  const patterns = [
    // Chinese city names (Traditional/Simplified)
    /([北京|上海|廣州|深圳|台北|高雄|香港|澳門|東京|大阪|京都|首爾|釜山|倫敦|巴黎|紐約|洛杉磯|雪梨|多倫多|溫哥華|新加坡|曼谷|吉隆坡])/g,
    // English patterns  
    /(New York|Los Angeles|London|Paris|Tokyo|Beijing|Shanghai|Sydney|Toronto|Vancouver|Singapore|Bangkok|Kuala Lumpur)/gi,
    // Generic location patterns - broader matching
    /([A-Za-z\u4e00-\u9fff]{2,}(?:\s+[A-Za-z\u4e00-\u9fff]{2,})*)\s+(?:weather|天氣|氣象|forecast|預報)/gi,
    /(?:in|at|for)\s+([A-Za-z\u4e00-\u9fff]{2,}(?:\s+[A-Za-z\u4e00-\u9fff]{2,})*)/gi
  ];
  
  const testText = '倫敦 weather';
  
  console.log(`Testing text: "${testText}"`);
  console.log('='.repeat(50));
  
  patterns.forEach((pattern, index) => {
    console.log(`Pattern ${index + 1}:`, pattern);
    const matches = testText.match(pattern);
    console.log('   Matches:', matches);
    console.log('');
  });
  
  // Test specific character
  console.log('Testing specific characters:');
  const londonChar = '倫敦';
  console.log('   倫敦 character codes:', Array.from(londonChar).map(c => c.charCodeAt(0)));
  
  // Test simplified pattern
  const simplePattern = /(倫敦)/g;
  console.log('Simple pattern test:', testText.match(simplePattern));
  
  console.log('✅ Pattern debugging completed');
}

// Run the debug
debugPatterns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });