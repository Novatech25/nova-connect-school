#!/bin/bash

set -e

PLATFORM=${1:-all}
ENV=${2:-production}

echo "🚀 Deploying NovaConnect Mobile App ($PLATFORM)..."

# Check environment
if [ -z "$EXPO_TOKEN" ]; then
  echo "❌ Error: EXPO_TOKEN must be set"
  exit 1
fi

# Build mobile app
echo "📦 Building mobile app..."
cd apps/mobile

if [ "$PLATFORM" = "all" ] || [ "$PLATFORM" = "android" ]; then
  echo "🤖 Building Android..."
  eas build --platform android --profile $ENV --non-interactive
fi

if [ "$PLATFORM" = "all" ] || [ "$PLATFORM" = "ios" ]; then
  echo "🍎 Building iOS..."
  eas build --platform ios --profile $ENV --non-interactive
fi

cd ..

# Notify team
echo "📢 Notifying team..."
if [ -n "$SLACK_WEBHOOK" ]; then
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"✅ NovaConnect Mobile ($PLATFORM) deployed to $ENV successfully\"}"
fi

echo "✅ Mobile deploy completed!"
