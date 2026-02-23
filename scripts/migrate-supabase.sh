#!/bin/bash

ENV=${1:-development}

echo "🗄️  Migrating Supabase ($ENV)..."

# Link to appropriate Supabase project
case $ENV in
  development)
    supabase link --project-ref local
    ;;
  staging)
    supabase link --project-ref $SUPABASE_STAGING_PROJECT_ID
    ;;
  production)
    supabase link --project-ref $SUPABASE_PRODUCTION_PROJECT_ID
    ;;
  *)
    echo "❌ Unknown environment: $ENV"
    echo "Usage: ./migrate-supabase.sh [development|staging|production]"
    exit 1
    ;;
esac

# Apply migrations
echo "📤 Applying migrations..."
supabase db push

# Generate types
echo "🔷 Generating TypeScript types..."
supabase gen types typescript > packages/data/src/types/database.generated.ts

# Seed data (dev/staging only)
if [ "$ENV" != "production" ]; then
  echo "🌱 Seeding data..."
  supabase db reset --seed
fi

echo "✅ Migration completed!"
