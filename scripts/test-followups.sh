#!/bin/bash

# Script de test automatisé pour les Edge Functions de relances
# Tests sur les emails envoyés à zakariakoffi@karta-holding.ci

set -e

echo "🧪 === DÉBUT DES TESTS EDGE FUNCTIONS FOLLOWUPS ==="
echo ""

# Variables
BASE_URL="http://127.0.0.1:54321/functions/v1"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
TARGET_EMAIL="zakariakoffi@karta-holding.ci"

# Fonction pour afficher le statut des emails de test
check_test_emails() {
    echo "📧 Emails envoyés à $TARGET_EMAIL:"
    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
        SELECT id, subject, sent_at, status
        FROM tracked_emails
        WHERE '$TARGET_EMAIL' = ANY(recipient_emails)
        ORDER BY sent_at DESC LIMIT 5;
    "
    echo ""
}

# Fonction pour vérifier les relances programmées
check_scheduled_followups() {
    echo "📅 Relances programmées pour $TARGET_EMAIL:"
    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
        SELECT f.id, f.followup_number, f.subject, f.scheduled_for, f.status, te.subject as original_subject
        FROM followups f
        JOIN tracked_emails te ON f.tracked_email_id = te.id
        WHERE '$TARGET_EMAIL' = ANY(te.recipient_emails)
        ORDER BY f.scheduled_for DESC;
    "
    echo ""
}

# Fonction pour tester followup-scheduler
test_scheduler() {
    echo "🎯 TEST 1: followup-scheduler"
    echo "Déclenchement de la planification automatique..."

    curl -s -X POST "$BASE_URL/followup-scheduler" \
        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d '{}' | jq .
    echo ""
}

# Fonction pour tester followup-sender
test_sender() {
    echo "📮 TEST 2: followup-sender"
    echo "Déclenchement de l'envoi des relances prêtes..."

    curl -s -X POST "$BASE_URL/followup-sender" \
        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d '{}' | jq .
    echo ""
}

# Fonction pour reset l'environnement debug
reset_debug_env() {
    echo "🔄 RESET: Nettoyage environnement debug"

    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
        -- Supprimer toutes les relances programmées pour les emails de test
        DELETE FROM followups WHERE tracked_email_id IN (
            SELECT id FROM tracked_emails WHERE '$TARGET_EMAIL' = ANY(recipient_emails)
        );

        -- Remettre les emails en statut pending
        UPDATE tracked_emails
        SET status = 'pending'
        WHERE '$TARGET_EMAIL' = ANY(recipient_emails) AND status != 'responded';
    " > /dev/null

    echo "✅ Environnement reset"
    echo ""
}

# Fonction pour test complet
full_test_cycle() {
    echo "🚀 TEST CYCLE COMPLET"
    echo "1. Reset environnement"
    reset_debug_env

    echo "2. Vérification état initial"
    check_test_emails
    check_scheduled_followups

    echo "3. Test scheduler (planification)"
    test_scheduler
    sleep 2
    check_scheduled_followups

    echo "4. Attente 3 minutes pour déclenchement automatique..."
    for i in {180..1}; do
        echo -ne "\r⏳ Attente: ${i}s"
        sleep 1
    done
    echo ""
    echo ""

    echo "5. Test sender (envoi relances prêtes)"
    test_sender
    sleep 2
    check_scheduled_followups

    echo "🎉 Test cycle complet terminé!"
}

# Menu principal
case "${1:-full}" in
    "reset")
        reset_debug_env
        ;;
    "check")
        check_test_emails
        check_scheduled_followups
        ;;
    "scheduler")
        test_scheduler
        check_scheduled_followups
        ;;
    "sender")
        test_sender
        check_scheduled_followups
        ;;
    "full")
        full_test_cycle
        ;;
    *)
        echo "Usage: $0 [reset|check|scheduler|sender|full]"
        echo ""
        echo "  reset     - Nettoie l'environnement debug"
        echo "  check     - Vérifie l'état des emails et relances"
        echo "  scheduler - Teste followup-scheduler uniquement"
        echo "  sender    - Teste followup-sender uniquement"
        echo "  full      - Cycle complet de test (défaut)"
        ;;
esac