#!/usr/bin/env bash
set -euo pipefail

# Simple HTTP load test helper for Smart Weather MCP Server
# - Supports /health and /mcp minimal JSON-RPC calls
# - Writes CSV results to .loadtest/
# - Intended for manual validation; does NOT change any remote config

usage() {
  cat <<'USAGE'
Usage: scripts/load-test.sh --url <BASE_URL> --type <health|mcp-weather|mcp-weather-complex|mcp-location> [--count 200] [--concurrency 10]

Examples:
  # Health endpoint hot path
  scripts/load-test.sh --url https://example.run.app --type health --count 50 --concurrency 5

  # Weather tool (simple, rule-friendly)
  scripts/load-test.sh --url https://example.run.app --type mcp-weather --count 200 --concurrency 20

  # Weather tool (complex, tends to trigger AI)
  scripts/load-test.sh --url https://example.run.app --type mcp-weather-complex --count 200 --concurrency 10

  # Location tool multilingual
  scripts/load-test.sh --url https://example.run.app --type mcp-location --count 200 --concurrency 20

Notes:
  - For AI disabled scenario, redeploy Cloud Run with GEMINI_DISABLED=true, then run the same commands.
  - CSV output saved under .loadtest/run-<timestamp>.csv
USAGE
}

BASE_URL=""
TYPE=""
COUNT=50
CONCURRENCY=10

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      BASE_URL="$2"; shift 2;;
    --type)
      TYPE="$2"; shift 2;;
    --count)
      COUNT="$2"; shift 2;;
    --concurrency)
      CONCURRENCY="$2"; shift 2;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown arg: $1" >&2; usage; exit 1;;
  esac
done

if [[ -z "$BASE_URL" || -z "$TYPE" ]]; then
  usage; exit 1
fi

mkdir -p .loadtest
RUN_ID=$(date +%s)
OUT_FILE=".loadtest/run-${RUN_ID}.csv"
echo "type,index,status,time_total_ms" > "$OUT_FILE"

payload_weather_simple='{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"search_weather",
    "arguments":{ "query":"台北今天天氣", "context":"語言: zh-TW" }
  }
}'

payload_weather_complex='{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"search_weather",
    "arguments":{ "query":"沖繩明天天氣預報 衝浪條件 海浪高度 風速", "context":"語言: zh-TW" }
  }
}'

payload_location='{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{
    "name":"find_location",
    "arguments":{ "query":"東京車站", "context":"語言: zh-TW" }
  }
}'

do_call() {
  local idx="$1"
  local url="$2"
  local type="$3"

  if [[ "$type" == "health" ]]; then
    # GET /health
    res=$(curl -sS -o /dev/null -w "%{http_code},%{time_total}" "$url/health") || res="000,0"
  else
    local payload
    case "$type" in
      mcp-weather) payload="$payload_weather_simple";;
      mcp-weather-complex) payload="$payload_weather_complex";;
      mcp-location) payload="$payload_location";;
      *) echo "Unsupported type: $type" >&2; exit 1;;
    esac
    res=$(curl -sS -o /dev/null \
      -H 'Content-Type: application/json' \
      -H 'Accept: text/event-stream,application/json' \
      -H "Origin: $BASE_URL" \
      -w "%{http_code},%{time_total}" \
      -X POST "$url/mcp" \
      --data "$payload") || res="000,0"
  fi

  code="${res%,*}"
  secs="${res#*,}"
  ms=$(awk -v s="$secs" 'BEGIN{printf "%.0f", s*1000}')
  echo "$TYPE,$idx,$code,$ms" >> "$OUT_FILE"
}

export -f do_call
export OUT_FILE TYPE

echo "Running load test: type=$TYPE count=$COUNT concurrency=$CONCURRENCY url=$BASE_URL"

seq 1 "$COUNT" | xargs -I{} -P "$CONCURRENCY" bash -c 'do_call "$@"' _ {} "$BASE_URL" "$TYPE"

echo "Saved: $OUT_FILE"

# Simple summary
total=$(tail -n +2 "$OUT_FILE" | wc -l | awk '{print $1}')
success=$(tail -n +2 "$OUT_FILE" | awk -F, '{if($3 ~ /^2/ || $3 ~ /^1/){ok++}} END{print ok+0}')
p95=$(tail -n +2 "$OUT_FILE" | awk -F, '{print $4}' | sort -n | awk -v c="$total" '{a[NR]=$1} END{if(c>0){idx=int(0.95*c); if(idx<1) idx=1; print a[idx]}}')
echo "Summary: total=$total success=$success p95_ms=$p95"


