#!/bin/bash

# Smart Weather MCP Server - Cloud Run Deployment Script
# This script deploys the application to Google Cloud Run

set -e

# Configuration
PROJECT_ID="striped-history-467517-m3"
SERVICE_NAME="smart-weather-mcp-server"
REGION="asia-east1"
GAR_LOCATION="asia-east1"
IMAGE_TAG=${1:-"latest"}

# Derived variables
IMAGE_URL="$GAR_LOCATION-docker.pkg.dev/$PROJECT_ID/$SERVICE_NAME/$SERVICE_NAME:$IMAGE_TAG"

echo "🚀 Deploying Smart Weather MCP Server to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo "Image: $IMAGE_URL"

# Build and push image if tag is 'latest' or 'build'
if [[ "$IMAGE_TAG" == "latest" || "$IMAGE_TAG" == "build" ]]; then
    echo "🔨 Building and pushing Docker image..."
    
    # Build image
    docker build -t "$IMAGE_URL" .
    
    # Push to Artifact Registry
    docker push "$IMAGE_URL"
    
    echo "✅ Image built and pushed successfully"
fi

# Deploy to Cloud Run
echo "📦 Deploying to Cloud Run..."

gcloud run deploy $SERVICE_NAME \
    --image=$IMAGE_URL \
    --project=$PROJECT_ID \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --cpu=1 \
    --memory=512Mi \
    --concurrency=80 \
    --min-instances=0 \
    --max-instances=10 \
    --timeout=300 \
    --set-secrets="GEMINI_API_KEY=projects/891745610397/secrets/gemini-api-key:latest,WEATHER_API_KEY=projects/891745610397/secrets/weather-api-key:latest" \
    --set-env-vars="NODE_ENV=production,HOST=0.0.0.0" \
    --execution-environment=gen2

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --project=$PROJECT_ID --region=$REGION --format="value(status.url)")

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Service URL: $SERVICE_URL"
echo "🏥 Health check: $SERVICE_URL/health"
echo ""
echo "🔧 Useful commands:"
echo "  View logs: gcloud logs tail --follow --project=$PROJECT_ID --filter='resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME'"
echo "  Update traffic: gcloud run services update-traffic $SERVICE_NAME --to-latest --project=$PROJECT_ID --region=$REGION"
echo "  View service: gcloud run services describe $SERVICE_NAME --project=$PROJECT_ID --region=$REGION"
