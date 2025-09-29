#!/bin/bash

# Script to quickly disable the followup system
# Usage: ./scripts/disable-followups.sh [environment]
# Environment: local (default) or production

ENVIRONMENT=${1:-local}

if [ "$ENVIRONMENT" = "local" ]; then
    echo "🔧 Disabling followup system in LOCAL environment..."
    psql postgresql://postgres:postgres@localhost:54322/postgres -c "
        UPDATE system_config
        SET value = jsonb_set(value::jsonb, '{enabled}', 'false'::jsonb)
        WHERE key = 'followup_settings';

        SELECT 'Followup system disabled' as status, value FROM system_config WHERE key = 'followup_settings';
    "
elif [ "$ENVIRONMENT" = "production" ]; then
    echo "🚨 PRODUCTION: Disabling followup system..."
    echo "⚠️  Make sure you have the production database connection details"
    echo "📝 You'll need to run this SQL on your production database:"
    echo ""
    cat scripts/disable-followup-system.sql
    echo ""
    echo "🔗 Or use Supabase dashboard SQL editor with the above query"
else
    echo "❌ Invalid environment. Use 'local' or 'production'"
    exit 1
fi