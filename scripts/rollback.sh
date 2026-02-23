#!/bin/bash

set -e

export ENV=${2:-production}
SERVICE=${1:-web}

echo "🔄 Rolling back $SERVICE (environment: $ENV)..."

if [ "$SERVICE" = "web" ]; then
  echo "🌐 Rolling back web deployment..."
  vercel rollback --yes

  # Get deployment URL from Vercel
  echo "🔍 Getting deployment URL..."
  DEPLOYMENT_URL=$(vercel ls --scope $VERCEL_ORG_ID -t $VERCEL_TOKEN | grep "$ENV" | awk '{print $2}' | head -n 1)

  if [ -z "$DEPLOYMENT_URL" ]; then
    echo "❌ Error: Could not retrieve deployment URL for environment: $ENV"
    exit 1
  fi

  export APP_URL=$DEPLOYMENT_URL
  echo "📍 Deployment URL: $APP_URL"

  # Verify rollback
  sleep 5
  HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$APP_URL/api/health)

  if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Web rollback successful"
  else
    echo "❌ Web rollback failed"
    exit 1
  fi

elif [ "$SERVICE" = "mobile" ]; then
  echo "📱 Rolling back mobile deployment..."
  echo "⚠️  Mobile rollback requires manual action in EAS dashboard"
  echo "🔗 https://expo.dev/accounts/novaconnect/projects/novaconnect"

else
  echo "❌ Unknown service: $SERVICE"
  echo "Usage: ./rollback.sh [web|mobile]"
  exit 1
fi

# Notify team
if [ -n "$SLACK_WEBHOOK" ]; then
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"🔄 Rollback completed for $SERVICE\"}"
fi

echo "✅ Rollback completed!"
