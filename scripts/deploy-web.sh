#!/bin/bash

set -e

export ENV=${1:-production}

echo "🚀 Deploying NovaConnect Web App..."

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set"
  exit 1
fi

# Get deployed URL from Vercel
echo "🔍 Getting deployment URL..."
DEPLOYMENT_URL=$(vercel ls --scope $VERCEL_ORG_ID -t $VERCEL_TOKEN | grep "$ENV" | awk '{print $2}' | head -n 1)

if [ -z "$DEPLOYMENT_URL" ]; then
  echo "❌ Error: Could not retrieve deployment URL for environment: $ENV"
  exit 1
fi

export APP_URL=$DEPLOYMENT_URL
echo "📍 Deployment URL: $APP_URL"

# Build web app
echo "📦 Building web app..."
pnpm build:web

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
if [ "$ENV" = "production" ]; then
  vercel --prod
else
  vercel --env $ENV
fi

# Health check
echo "🏥 Running health check..."
sleep 5
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$APP_URL/api/health)

if [ "$HEALTH_STATUS" = "200" ]; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed with status $HEALTH_STATUS"
  exit 1
fi

# Notify team
echo "📢 Notifying team..."
if [ -n "$SLACK_WEBHOOK" ]; then
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"✅ NovaConnect Web deployed to $ENV successfully\"}"
fi

echo "✅ Deploy completed successfully!"
