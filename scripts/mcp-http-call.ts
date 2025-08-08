#!/usr/bin/env tsx
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

interface Args {
  url: string;
  tool: string;
  query: string;
  context?: string;
}

function parseArgs(): Args {
  const args: any = {};
  for (let i = 2; i < process.argv.length; i++) {
    const [k, v] = process.argv[i].split('=');
    if (k === '--url') args.url = v;
    if (k === '--tool') args.tool = v;
    if (k === '--query') args.query = v;
    if (k === '--context') args.context = v;
  }
  if (!args.url || !args.tool || !args.query) {
    console.error('Usage: tsx scripts/mcp-http-call.ts --url=<BASE_URL> --tool=<search_weather|find_location|get_weather_advice> --query=<text> [--context=<text>]');
    process.exit(1);
  }
  return args as Args;
}

async function main() {
  const { url, tool, query, context } = parseArgs();

  const origin = url; // Use base URL as origin for DNS rebinding protection
  const transport = new StreamableHTTPClientTransport(`${url}/mcp`, { origin });
  const client = new Client({ name: 'load-test-client', version: '1.0.0' }, { capabilities: { tools: {} } });

  const start = Date.now();
  await client.connect(transport);
  const connectedAt = Date.now();

  const tools = await client.listTools();
  const hasTool = (tools.tools || []).some((t: any) => t.name === tool);
  if (!hasTool) {
    throw new Error(`Tool '${tool}' not found. Available: ${(tools.tools || []).map((t:any)=>t.name).join(', ')}`);
  }

  const res = await client.callTool({ name: tool, arguments: { query, context } });
  const end = Date.now();

  // Print minimal metrics
  console.log(JSON.stringify({
    ok: true,
    tool,
    connect_ms: connectedAt - start,
    call_ms: end - connectedAt,
    total_ms: end - start,
  }));
  process.exit(0);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }));
  process.exit(1);
});


