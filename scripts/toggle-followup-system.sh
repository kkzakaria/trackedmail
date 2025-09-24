#!/bin/bash

# Script pour activer/désactiver le système de relances
# Usage: ./scripts/toggle-followup-system.sh [enable|disable|status]

set -e

DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

case "${1:-status}" in
    "enable")
        echo "🟢 Activation du système de relances..."
        psql "$DATABASE_URL" -c "
            UPDATE system_config
            SET value = '{\"enabled\": true, \"max_followups\": 3, \"stop_on_bounce\": true, \"stop_after_days\": 30, \"stop_on_unsubscribe\": true, \"default_interval_hours\": 4}'
            WHERE key = 'followup_settings';
        " > /dev/null
        echo "✅ Système de relances ACTIVÉ"
        ;;

    "disable")
        echo "🔴 Désactivation du système de relances..."
        psql "$DATABASE_URL" -c "
            UPDATE system_config
            SET value = '{\"enabled\": false, \"max_followups\": 3, \"stop_on_bounce\": true, \"stop_after_days\": 30, \"stop_on_unsubscribe\": true, \"default_interval_hours\": 4}'
            WHERE key = 'followup_settings';
        " > /dev/null
        echo "✅ Système de relances DÉSACTIVÉ"
        ;;

    "status")
        echo "📊 Statut du système de relances:"
        psql "$DATABASE_URL" -c "
            SELECT
                CASE
                    WHEN (value::json->>'enabled')::boolean = false THEN '🔴 DÉSACTIVÉ'
                    ELSE '🟢 ACTIVÉ'
                END as statut,
                'Intervalles: ' || (value::json->>'default_interval_hours') || 'h' as config,
                'Max relances: ' || (value::json->>'max_followups') as limite
            FROM system_config
            WHERE key = 'followup_settings';
        "
        ;;

    *)
        echo "Usage: $0 [enable|disable|status]"
        echo ""
        echo "  enable   - Active le système de relances"
        echo "  disable  - Désactive le système de relances"
        echo "  status   - Affiche le statut actuel (défaut)"
        exit 1
        ;;
esac