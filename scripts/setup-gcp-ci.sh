#!/bin/bash

# Smart Weather MCP Server - GCP CI/CD Setup Script
# This script sets up Workload Identity Federation and Service Account for GitHub Actions

set -e

# Configuration
PROJECT_ID="striped-history-467517-m3"
PROJECT_NUMBER="891745610397"
SERVICE_ACCOUNT_NAME="github-ci-deployer"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
WIF_POOL_ID="github-pool"
WIF_PROVIDER_ID="github-provider"
GITHUB_REPO="lis186/smart-weather-mcp-server"
GAR_REPO_NAME="smart-weather-mcp-server"
REGION="asia-east1"

echo "🚀 Setting up GCP CI/CD for Smart Weather MCP Server"
echo "Project: $PROJECT_ID"
echo "GitHub Repo: $GITHUB_REPO"

# Enable required APIs
echo "📋 Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    iamcredentials.googleapis.com \
    --project=$PROJECT_ID

# Create Artifact Registry repository
echo "📦 Creating Artifact Registry repository..."
gcloud artifacts repositories create $GAR_REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Smart Weather MCP Server Docker images" \
    --project=$PROJECT_ID || echo "Repository may already exist"

# Create Service Account
echo "👤 Creating Service Account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --description="Service account for GitHub Actions CI/CD" \
    --display-name="GitHub CI Deployer" \
    --project=$PROJECT_ID || echo "Service Account may already exist"

# Grant necessary roles to Service Account
echo "🔐 Granting roles to Service Account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/iam.serviceAccountTokenCreator"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/secretmanager.secretAccessor"

# Create Workload Identity Pool
echo "🔗 Creating Workload Identity Pool..."
gcloud iam workload-identity-pools create $WIF_POOL_ID \
    --project=$PROJECT_ID \
    --location="global" \
    --display-name="GitHub Actions Pool" \
    --description="Pool for GitHub Actions OIDC" || echo "Pool may already exist"

# Create Workload Identity Provider
echo "🔗 Creating Workload Identity Provider..."
gcloud iam workload-identity-pools providers create-oidc $WIF_PROVIDER_ID \
    --project=$PROJECT_ID \
    --location="global" \
    --workload-identity-pool=$WIF_POOL_ID \
    --display-name="GitHub Actions Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --issuer-uri="https://token.actions.githubusercontent.com" || echo "Provider may already exist"

# Allow GitHub Actions to impersonate Service Account
echo "🔑 Setting up Service Account impersonation..."
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
    --project=$PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL_ID/attribute.repository/$GITHUB_REPO"

# Output GitHub Secrets
echo ""
echo "✅ Setup completed! Add these secrets to your GitHub repository:"
echo ""
echo "WIF_PROVIDER: projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL_ID/providers/$WIF_PROVIDER_ID"
echo "WIF_SERVICE_ACCOUNT: $SERVICE_ACCOUNT_EMAIL"
echo ""
echo "🔧 GitHub Secrets setup command:"
echo "gh secret set WIF_PROVIDER --body \"projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL_ID/providers/$WIF_PROVIDER_ID\""
echo "gh secret set WIF_SERVICE_ACCOUNT --body \"$SERVICE_ACCOUNT_EMAIL\""
echo ""
echo "📦 Artifact Registry URL:"
echo "$REGION-docker.pkg.dev/$PROJECT_ID/$GAR_REPO_NAME"
echo ""
echo "🎉 Ready to deploy! Push to main branch to trigger deployment."
