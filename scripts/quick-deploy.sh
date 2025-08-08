#!/bin/bash

# Smart Weather MCP Server - Quick Deploy Script
# This script performs complete setup and deployment in one go

set -e

echo "🚀 Smart Weather MCP Server - Quick Deploy"
echo "=========================================="

# Check prerequisites
command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "⚠️  GitHub CLI not found. You'll need to set GitHub Secrets manually." >&2; }

# Configuration
PROJECT_ID="striped-history-467517-m3"
SERVICE_NAME="smart-weather-mcp-server"

echo "📋 Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Service: $SERVICE_NAME"
echo ""

# Step 1: GCP Setup
echo "🔧 Step 1: Setting up GCP environment..."
./scripts/setup-gcp-ci.sh

echo ""

# Step 2: Secret Manager Setup
echo "🔐 Step 2: Setting up Secret Manager..."
./scripts/setup-secrets.sh

echo ""
echo "⚠️  IMPORTANT: You need to add your API keys to Secret Manager:"
echo "   1. Gemini API Key:"
echo "      echo 'YOUR_GEMINI_API_KEY' | gcloud secrets versions add gemini-api-key --data-file=- --project=$PROJECT_ID"
echo "   2. Weather API Key:"
echo "      echo 'YOUR_WEATHER_API_KEY' | gcloud secrets versions add weather-api-key --data-file=- --project=$PROJECT_ID"
echo ""

read -p "Have you added the API keys? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "❌ Please add the API keys first, then run this script again."
    exit 1
fi

# Step 3: GitHub Secrets (if GitHub CLI available)
if command -v gh >/dev/null 2>&1; then
    echo "🔑 Step 3: Setting up GitHub Secrets..."
    
    WIF_PROVIDER="projects/891745610397/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
    WIF_SERVICE_ACCOUNT="github-ci-deployer@$PROJECT_ID.iam.gserviceaccount.com"
    
    gh secret set WIF_PROVIDER --body "$WIF_PROVIDER"
    gh secret set WIF_SERVICE_ACCOUNT --body "$WIF_SERVICE_ACCOUNT"
    
    echo "✅ GitHub Secrets set successfully!"
else
    echo "⚠️  Step 3: Please set GitHub Secrets manually:"
    echo "   WIF_PROVIDER: projects/891745610397/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
    echo "   WIF_SERVICE_ACCOUNT: github-ci-deployer@$PROJECT_ID.iam.gserviceaccount.com"
fi

echo ""

# Step 4: Initial Deployment
echo "🚀 Step 4: Performing initial deployment..."
read -p "Deploy now? (y/N): " deploy_confirm
if [[ $deploy_confirm == [yY] ]]; then
    ./scripts/deploy-cloudrun.sh build
    echo ""
    echo "✅ Initial deployment completed!"
else
    echo "⏭️  Skipping initial deployment. You can deploy later with:"
    echo "   ./scripts/deploy-cloudrun.sh"
    echo "   or push to main branch for automatic deployment."
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "📚 Next steps:"
echo "  1. Test the service: curl \$(gcloud run services describe $SERVICE_NAME --region=asia-east1 --format='value(status.url)')/health"
echo "  2. View logs: gcloud logs tail --follow --project=$PROJECT_ID --filter='resource.type=cloud_run_revision'"
echo "  3. Automatic deployment: Push to main branch triggers GitHub Actions deployment"
echo "  4. Manual deployment: ./scripts/deploy-cloudrun.sh"
echo ""
echo "📖 Full documentation: docs/setup/DEPLOYMENT.md"
