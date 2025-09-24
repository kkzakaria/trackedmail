#!/bin/bash

# Script de test pour vérifier le système de relances avec threading
# Ce script permet de tester manuellement les Edge Functions

set -e

echo "📧 Test du système de relances avec threading"
echo "============================================"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Charger les variables d'environnement
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Vérifier que Supabase est démarré
echo -e "${YELLOW}Vérification du statut Supabase...${NC}"
supabase status

# Menu de test
echo ""
echo "Choisissez une action :"
echo "1. Tester followup-scheduler (programme les relances)"
echo "2. Tester followup-sender (envoie les relances)"
echo "3. Tester microsoft-webhook (validation des headers)"
echo "4. Test complet du flux"

read -p "Votre choix (1-4): " choice

case $choice in
    1)
        echo -e "${GREEN}Test de followup-scheduler...${NC}"
        curl -i --location --request POST \
            "http://localhost:54321/functions/v1/followup-scheduler" \
            --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
            --header "Content-Type: application/json"
        ;;

    2)
        echo -e "${GREEN}Test de followup-sender...${NC}"
        curl -i --location --request POST \
            "http://localhost:54321/functions/v1/followup-sender" \
            --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
            --header "Content-Type: application/json"
        ;;

    3)
        echo -e "${GREEN}Test de microsoft-webhook avec headers de relance...${NC}"
        # Simule un webhook avec les headers de relance
        curl -i --location --request POST \
            "http://localhost:54321/functions/v1/microsoft-webhook" \
            --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
            --header "Content-Type: application/json" \
            --data '{
                "value": [{
                    "subscriptionId": "test-subscription",
                    "changeType": "created",
                    "tenantId": "test-tenant",
                    "clientState": "'$MICROSOFT_WEBHOOK_SECRET'",
                    "subscriptionExpirationDateTime": "2025-01-01T00:00:00Z",
                    "resource": "Users/test-user/Messages/test-message",
                    "resourceData": {
                        "@odata.type": "#Microsoft.Graph.Message",
                        "@odata.id": "test-id",
                        "id": "test-message-id"
                    }
                }]
            }'
        ;;

    4)
        echo -e "${GREEN}Test complet du flux de relances...${NC}"
        echo "1. Programmation des relances..."
        curl -s -X POST \
            "http://localhost:54321/functions/v1/followup-scheduler" \
            --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
            --header "Content-Type: application/json" | jq .

        echo ""
        echo "2. Envoi des relances programmées..."
        curl -s -X POST \
            "http://localhost:54321/functions/v1/followup-sender" \
            --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
            --header "Content-Type: application/json" | jq .

        echo ""
        echo -e "${GREEN}✅ Test complet terminé${NC}"
        ;;

    *)
        echo -e "${RED}Choix invalide${NC}"
        exit 1
        ;;
esac

echo ""
echo "Pour vérifier les logs des Edge Functions :"
echo "  docker logs supabase_edge_runtime -f --tail=50"
echo ""
echo "Pour vérifier les emails trackés :"
echo "  psql -h localhost -p 54322 -U postgres -d postgres -c 'SELECT id, subject, status, created_at FROM tracked_emails ORDER BY created_at DESC LIMIT 10;'"