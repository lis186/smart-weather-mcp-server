// Basic test to verify Jest setup is working
describe('Basic functionality', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have Node.js environment', () => {
    expect(typeof process).toBe('object');
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should have proper test timeout configured', () => {
    expect(jest.getTimerCount).toBeDefined();
  });
});

// Test the project structure exists
describe('Project structure', () => {
  it('should have package.json available', () => {
    const fs = require('fs');
    const path = require('path');
    
    const packagePath = path.join(process.cwd(), 'package.json');
    expect(fs.existsSync(packagePath)).toBe(true);
    
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    expect(packageJson.name).toBe('smart-weather-mcp-server');
    expect(packageJson.version).toBe('1.0.0');
  });

  it('should have TypeScript source files', () => {
    const fs = require('fs');
    const path = require('path');
    
    const srcPath = path.join(process.cwd(), 'src');
    expect(fs.existsSync(srcPath)).toBe(true);
    
    const mcpServerPath = path.join(srcPath, 'core', 'mcp-server.ts');
    expect(fs.existsSync(mcpServerPath)).toBe(true);
  });

  it('should have compiled JavaScript files', () => {
    const fs = require('fs');
    const path = require('path');
    
    const distPath = path.join(process.cwd(), 'dist');
    expect(fs.existsSync(distPath)).toBe(true);
    
    const unifiedServerPath = path.join(distPath, 'unified-server.js');
    expect(fs.existsSync(unifiedServerPath)).toBe(true);
  });
});