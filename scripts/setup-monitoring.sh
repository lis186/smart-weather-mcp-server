#!/usr/bin/env bash
set -euo pipefail

# Smart Weather MCP Server - Monitoring & Alerts Setup
# Usage (DRY RUN by default):
#   PROJECT_ID=your-project SERVICE_NAME=smart-weather-mcp-server REGION=asia-east1 NOTIFY_EMAIL=you@example.com \
#   DRY_RUN=true bash scripts/setup-monitoring.sh
#
# To actually create in GCP (requires gcloud auth and proper roles):
#   DRY_RUN=false bash scripts/setup-monitoring.sh

PROJECT_ID=${PROJECT_ID:-}
SERVICE_NAME=${SERVICE_NAME:-}
REGION=${REGION:-}
NOTIFY_EMAIL=${NOTIFY_EMAIL:-}
DRY_RUN=${DRY_RUN:-true}

if [[ -z "$PROJECT_ID" || -z "$SERVICE_NAME" || -z "$REGION" || -z "$NOTIFY_EMAIL" ]]; then
  echo "❌ Missing required env vars. Please set PROJECT_ID, SERVICE_NAME, REGION, NOTIFY_EMAIL" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALERTS_DIR="$ROOT_DIR/alerts"
DASH_DIR="$ROOT_DIR/dashboards"
OUT_DIR="$ROOT_DIR/.monitoring-out"
mkdir -p "$OUT_DIR"

echo "⚙️  Monitoring setup (DRY_RUN=$DRY_RUN)"
echo "  Project:  $PROJECT_ID"
echo "  Service:  $SERVICE_NAME"
echo "  Region:   $REGION"
echo "  Notify:   $NOTIFY_EMAIL"
echo "  Output:   $OUT_DIR"

CHANNEL_NAME="Oncall Email ($NOTIFY_EMAIL)"

create_channel() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Would create notification channel: $CHANNEL_NAME"
    echo "gcloud alpha monitoring channels create --type=email --display-name=\"$CHANNEL_NAME\" --channel-labels=email_address=$NOTIFY_EMAIL --project=$PROJECT_ID"
    echo "CH_ID=fake-channel-id" >"$OUT_DIR/channel.env"
  else
    CH_ID=$(gcloud alpha monitoring channels create \
      --type=email \
      --display-name="$CHANNEL_NAME" \
      --channel-labels="email_address=$NOTIFY_EMAIL" \
      --project="$PROJECT_ID" \
      --format="value(name)" | sed 's#.*/##')
    printf "CH_ID=%s\n" "$CH_ID" >"$OUT_DIR/channel.env"
  fi
}

render_template() {
  local tpl="$1"; shift
  local out="$1"; shift
  sed -e "s#{{PROJECT_ID}}#$PROJECT_ID#g" \
      -e "s#{{SERVICE_NAME}}#$SERVICE_NAME#g" \
      -e "s#{{REGION}}#$REGION#g" \
      -e "s#{{NOTIFICATION_CHANNEL_ID}}#$NOTIFICATION_CHANNEL_ID#g" \
      "$tpl" > "$out"
  if command -v jq >/dev/null 2>&1; then
    jq . "$out" >/dev/null || { echo "❌ JSON validation failed: $out" >&2; exit 1; }
  fi
}

create_policy() {
  local name="$1"; shift
  local tpl="$1"; shift
  local out="$OUT_DIR/$name.json"
  render_template "$tpl" "$out"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Would create alert policy: $name"
    echo "gcloud alpha monitoring policies create --policy-from-file=$out --project=$PROJECT_ID"
  else
    gcloud alpha monitoring policies create --policy-from-file="$out" --project="$PROJECT_ID"
  fi
}

create_dashboard() {
  local tpl="$DASH_DIR/cloud-run-smart-weather.json.tpl"
  local out="$OUT_DIR/dashboard.json"
  # channel not used in dashboard
  sed -e "s#{{SERVICE_NAME}}#$SERVICE_NAME#g" -e "s#{{REGION}}#$REGION#g" "$tpl" > "$out"
  if command -v jq >/dev/null 2>&1; then jq . "$out" >/dev/null || { echo "❌ JSON validation failed: $out" >&2; exit 1; }; fi
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Would create dashboard Smart Weather - Cloud Run"
    echo "gcloud alpha monitoring dashboards create --config-from-file=$out --project=$PROJECT_ID"
  else
    gcloud alpha monitoring dashboards create --config-from-file="$out" --project="$PROJECT_ID"
  fi
}

# 1) Create/preview notification channel (reuse if exists)
CH_ID_LINE=$(grep -m1 '^CH_ID=' "$OUT_DIR/channel.env" 2>/dev/null || true)
CH_ID_VALUE="${CH_ID_LINE#CH_ID=}"
if [[ -n "$CH_ID_VALUE" ]]; then
  echo "Using existing notification channel: $CH_ID_VALUE"
  NOTIFICATION_CHANNEL_ID="projects/$PROJECT_ID/notificationChannels/$CH_ID_VALUE"
else
  create_channel
  # Robustly extract channel id without sourcing
  CH_ID_LINE=$(grep -m1 '^CH_ID=' "$OUT_DIR/channel.env" 2>/dev/null || true)
  CH_ID_VALUE="${CH_ID_LINE#CH_ID=}"
  if [[ -n "$CH_ID_VALUE" ]]; then
    NOTIFICATION_CHANNEL_ID="projects/$PROJECT_ID/notificationChannels/$CH_ID_VALUE"
  else
    NOTIFICATION_CHANNEL_ID="projects/$PROJECT_ID/notificationChannels/fake-channel-id"
  fi
fi

# 2) Render and create/preview alert policies
create_policy "p95-latency" "$ALERTS_DIR/p95-latency.json.tpl"
create_policy "5xx-error-rate-mql" "$ALERTS_DIR/5xx-error-rate-mql.json.tpl"
create_policy "memory-utilization" "$ALERTS_DIR/memory-utilization.json.tpl"

# 3) Render and create/preview dashboard
create_dashboard

echo "✅ Monitoring setup steps prepared (DRY_RUN=$DRY_RUN)."
echo "   Review generated files in $OUT_DIR."


