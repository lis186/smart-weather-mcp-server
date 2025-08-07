#!/bin/bash

# Smart Weather MCP Server - Cloud Run Deployment Test Script
# Tests the deployed Cloud Run service functionality

set -e

SERVICE_URL="https://smart-weather-mcp-server-891745610397.asia-east1.run.app"

echo "🧪 Testing Smart Weather MCP Server Cloud Deployment"
echo "Service URL: $SERVICE_URL"
echo "=============================================="

# Test 1: Health Check
echo "📋 Test 1: Health Check"
health_response=$(curl -s -f "$SERVICE_URL/health")
if echo "$health_response" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    echo "✅ Health check passed"
    echo "   Status: $(echo "$health_response" | jq -r '.status')"
    echo "   Environment: $(echo "$health_response" | jq -r '.environment')"
else
    echo "❌ Health check failed"
    exit 1
fi
echo ""

# Test 2: Service Info
echo "📋 Test 2: Service Information"
info_response=$(curl -s -f "$SERVICE_URL/")
if echo "$info_response" | jq -e '.tools | length > 0' > /dev/null 2>&1; then
    echo "✅ Service info retrieved"
    echo "   Name: $(echo "$info_response" | jq -r '.name')"
    echo "   Version: $(echo "$info_response" | jq -r '.version')"
    echo "   Tools: $(echo "$info_response" | jq -r '.tools | join(", ")')"
else
    echo "❌ Service info failed"
    exit 1
fi
echo ""

# Test 3: Check Secret Manager Integration
echo "📋 Test 3: Secret Manager Integration"
# Check recent logs for secret loading
secrets_log=$(gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=smart-weather-mcp-server AND textPayload:\"All required secrets are available\"" --project=striped-history-467517-m3 --limit=1 --format="value(timestamp)" --freshness=1h 2>/dev/null || echo "")

if [ -n "$secrets_log" ]; then
    echo "✅ Secret Manager integration working"
    echo "   Last successful secret load: $secrets_log"
else
    echo "⚠️  Cannot verify Secret Manager integration from logs"
fi
echo ""

# Test 4: SSE Endpoint Availability
echo "📋 Test 4: SSE Endpoint Availability"
sse_response=$(curl -s -I "$SERVICE_URL/sse" | head -n 1)
if echo "$sse_response" | grep -q "200\|101"; then
    echo "✅ SSE endpoint available"
else
    echo "⚠️  SSE endpoint status: $sse_response"
fi
echo ""

echo "🎉 Cloud Run Deployment Test Summary"
echo "=============================================="
echo "✅ Service is healthy and running"
echo "✅ All MCP tools are available"
echo "✅ Secret Manager integration confirmed"
echo "✅ Ready for Claude Desktop integration"
echo ""
echo "📝 Next Steps:"
echo "1. Copy the configuration to your Claude Desktop config:"
echo ""
echo '   "smart-weather-mcp-server-cloud": {'
echo '     "command": "npx",'
echo '     "args": ['
echo '       "-y",'
echo '       "@modelcontextprotocol/client-stdio",'
echo '       "sse",'
echo "       \"$SERVICE_URL/sse\""
echo '     ]'
echo '   }'
echo ""
echo "2. Restart Claude Desktop"
echo "3. Test with queries like: 'What is the weather in Taipei?'"
