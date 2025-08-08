#!/bin/bash

# Smart Weather MCP Server - Secret Manager Setup Script
# This script helps manage secrets in Google Cloud Secret Manager

set -e

PROJECT_ID="striped-history-467517-m3"

echo "🔐 Smart Weather MCP Server - Secret Manager Setup"
echo "Project: $PROJECT_ID"

# Function to create or update a secret
create_or_update_secret() {
    local secret_name=$1
    local description=$2
    
    echo "📝 Managing secret: $secret_name"
    
    # Check if secret exists
    if gcloud secrets describe $secret_name --project=$PROJECT_ID >/dev/null 2>&1; then
        echo "  Secret '$secret_name' already exists"
        echo "  To update the value, run:"
        echo "  echo 'YOUR_NEW_VALUE' | gcloud secrets versions add $secret_name --data-file=- --project=$PROJECT_ID"
    else
        echo "  Creating new secret: $secret_name"
        gcloud secrets create $secret_name \
            --description="$description" \
            --project=$PROJECT_ID
        
        echo "  Secret created. Add the value with:"
        echo "  echo 'YOUR_VALUE' | gcloud secrets versions add $secret_name --data-file=- --project=$PROJECT_ID"
    fi
    echo ""
}

# Create secrets
create_or_update_secret "gemini-api-key" "Gemini AI API key for weather query parsing"
create_or_update_secret "weather-api-key" "Google Weather API key for weather data"

# List all secrets
echo "📋 Current secrets in project:"
gcloud secrets list --project=$PROJECT_ID

echo ""
echo "✅ Secret Manager setup completed!"
echo ""
echo "🔧 Manual steps required:"
echo "1. Add your Gemini API key:"
echo "   echo 'YOUR_GEMINI_API_KEY' | gcloud secrets versions add gemini-api-key --data-file=- --project=$PROJECT_ID"
echo ""
echo "2. Add your Weather API key:"
echo "   echo 'YOUR_WEATHER_API_KEY' | gcloud secrets versions add weather-api-key --data-file=- --project=$PROJECT_ID"
echo ""
echo "3. Verify secrets:"
echo "   gcloud secrets versions list gemini-api-key --project=$PROJECT_ID"
echo "   gcloud secrets versions list weather-api-key --project=$PROJECT_ID"
