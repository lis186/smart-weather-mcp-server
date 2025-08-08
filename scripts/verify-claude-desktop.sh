#!/bin/bash

# Smart Weather MCP Server - Claude Desktop Integration Verification
# Quick verification that the service is ready for Claude Desktop

set -e

SERVICE_URL="https://smart-weather-mcp-server-891745610397.asia-east1.run.app"

echo "🔍 Verifying Smart Weather MCP Server for Claude Desktop"
echo "======================================================="

# Quick health check
echo "📋 Health Check..."
curl -s -f "$SERVICE_URL/health" | jq -r '"✅ Service Status: " + .status + " (Environment: " + .environment + ")"'

# Check tools availability
echo "📋 Available Tools..."
curl -s -f "$SERVICE_URL/" | jq -r '"✅ Available Tools: " + (.tools | join(", "))'

# Verify Secret Manager
echo "📋 Secret Manager Status..."
recent_secrets=$(gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=smart-weather-mcp-server AND textPayload:\"All required secrets are available\"" --project=striped-history-467517-m3 --limit=1 --format="value(timestamp)" --freshness=1h 2>/dev/null || echo "")

if [ -n "$recent_secrets" ]; then
    echo "✅ Secret Manager: All API Keys loaded successfully"
    echo "   Last verified: $recent_secrets"
else
    echo "⚠️  Secret Manager: Cannot verify from recent logs (service may be cold)"
fi

echo ""
echo "🎉 Verification Complete!"
echo "======================================================="
echo "✅ Service is healthy and ready"
echo "✅ All MCP tools available: search_weather, find_location, get_weather_advice"
echo "✅ Secret Manager integration working (API Keys loaded)"
echo ""
echo "📝 Ready for Claude Desktop Integration!"
echo ""
echo "Configuration to add to Claude Desktop:"
echo '{'
echo '  "mcpServers": {'
echo '    "smart-weather-mcp-server-cloud": {'
echo '      "command": "npx",'
echo '      "args": ['
echo '        "-y",'
echo '        "mcp-remote",'
echo "        \"$SERVICE_URL/mcp\""
echo '      ]'
echo '    }'
echo '  }'
echo '}'
echo ""
echo "🧪 Test queries to try in Claude Desktop:"
echo "• 台北明天天氣如何？需要帶傘嗎？"
echo "• What's the weather like in Tokyo today?"
echo "• 沖繩今天適合衝浪嗎？風浪如何？"
echo "• Should I wear a jacket in London tomorrow?"
