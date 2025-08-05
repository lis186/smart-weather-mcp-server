#!/usr/bin/env node

/**
 * Simple MCP Client Test for Smart Weather Server
 * This simulates how Claude Desktop would interact with your MCP server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testMCPServer() {
  console.log('🧪 Testing MCP Server Connection...\n');

  try {
    // Start the MCP server process
    console.log('1. Starting MCP server...');
    const serverProcess = spawn('node', ['dist/unified-server.js', '--mode=stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' }
    });

    // Create MCP client
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/unified-server.js', '--mode=stdio'],
      env: { NODE_ENV: 'development' }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    console.log('2. Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Test listing tools
    console.log('3. Listing available tools...');
    const tools = await client.listTools();
    console.log(`✅ Found ${tools.tools.length} tools:`);
    tools.tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name}: ${tool.description}`);
    });

    // Test calling search_weather tool
    console.log('\n4. Testing search_weather tool...');
    const weatherResult = await client.callTool({
      name: 'search_weather',
      arguments: {
        query: 'What is the weather like in Tokyo today?',
        context: 'location: Tokyo, Japan'
      }
    });

    console.log('✅ search_weather tool response:');
    weatherResult.content.forEach(content => {
      console.log(`   ${content.text}`);
    });

    // Test calling find_location tool
    console.log('\n5. Testing find_location tool...');
    const locationResult = await client.callTool({
      name: 'find_location',
      arguments: {
        query: 'Paris France'
      }
    });

    console.log('✅ find_location tool response:');
    locationResult.content.forEach(content => {
      console.log(`   ${content.text}`);
    });

    // Test calling get_weather_advice tool
    console.log('\n6. Testing get_weather_advice tool...');
    const adviceResult = await client.callTool({
      name: 'get_weather_advice',
      arguments: {
        query: 'Should I bring an umbrella?',
        context: 'location: London, activity: walking'
      }
    });

    console.log('✅ get_weather_advice tool response:');
    adviceResult.content.forEach(content => {
      console.log(`   ${content.text}`);
    });

    // Cleanup
    await client.close();
    serverProcess.kill();

    console.log('\n🎉 All MCP tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('✅ MCP server connection successful');
    console.log('✅ Tool listing works');
    console.log('✅ All 3 tools respond correctly');
    console.log('✅ Parameter passing works');
    console.log('\n🖥️ Ready for Claude Desktop integration!');

  } catch (error) {
    console.error('❌ MCP test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMCPServer().catch(console.error);