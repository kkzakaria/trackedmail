#!/bin/bash

# Script de test pour la fonction mailbox-email-processor
# Ce script teste la fonction edge avec différents scénarios

set -e

# Configuration
SUPABASE_URL="http://127.0.0.1:54321"
FUNCTION_URL="$SUPABASE_URL/functions/v1/mailbox-email-processor"
SERVICE_ROLE_KEY="sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"

echo "🚀 Test de la fonction mailbox-email-processor"
echo "URL: $FUNCTION_URL"
echo ""

# Test 1: Test de validation des paramètres (erreur attendue)
echo "📋 Test 1: Validation des paramètres manquants"
curl -i --location --request POST "$FUNCTION_URL" \
  --header "Authorization: Bearer $SERVICE_ROLE_KEY" \
  --header "Content-Type: application/json" \
  --data '{"invalidParam": "test"}' 2>/dev/null | head -20

echo -e "\n"

# Test 2: Test de validation des dates (erreur attendue)
echo "📋 Test 2: Validation des dates invalides"
curl -i --location --request POST "$FUNCTION_URL" \
  --header "Authorization: Bearer $SERVICE_ROLE_KEY" \
  --header "Content-Type: application/json" \
  --data '{"startDate": "invalid", "endDate": "invalid"}' 2>/dev/null | head -20

echo -e "\n"

# Test 3: Test de validation de la plage de dates (erreur attendue)
echo "📋 Test 3: Validation de la plage de dates (startDate >= endDate)"
curl -i --location --request POST "$FUNCTION_URL" \
  --header "Authorization: Bearer $SERVICE_ROLE_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-01-10T00:00:00Z"
  }' 2>/dev/null | head -20

echo -e "\n"

# Test 4: Test en mode dry run (test réel mais sans insertion)
echo "📋 Test 4: Mode dry run - dernière semaine"
curl -s --location --request POST "$FUNCTION_URL" \
  --header "Authorization: Bearer $SERVICE_ROLE_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "startDate": "2024-09-17T00:00:00Z",
    "endDate": "2024-09-24T23:59:59Z",
    "processResponses": true,
    "dryRun": true
  }' | python3 -m json.tool

echo -e "\n"

# Test 5: Test avec une petite période (test réel)
echo "📋 Test 5: Traitement réel - dernières 24 heures"
curl -s --location --request POST "$FUNCTION_URL" \
  --header "Authorization: Bearer $SERVICE_ROLE_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "startDate": "2024-09-23T00:00:00Z",
    "endDate": "2024-09-24T00:00:00Z",
    "processResponses": true,
    "dryRun": false
  }' | python3 -m json.tool

echo -e "\n"

# Test 6: Test avec mailbox spécifique (si vous connaissez un ID)
echo "📋 Test 6: Traitement d'une mailbox spécifique"
echo "Note: Ce test nécessite un ID de mailbox valide dans votre base de données"
echo "Vous pouvez récupérer les IDs avec: SELECT id, email_address FROM mailboxes WHERE is_active = true;"
echo ""

# Exemple avec un ID fictif - remplacez par un vrai ID
# curl -s --location --request POST "$FUNCTION_URL" \
#   --header "Authorization: Bearer $SERVICE_ROLE_KEY" \
#   --header "Content-Type: application/json" \
#   --data '{
#     "startDate": "2024-09-20T00:00:00Z",
#     "endDate": "2024-09-24T23:59:59Z",
#     "mailboxIds": ["uuid-de-votre-mailbox"],
#     "processResponses": true,
#     "dryRun": true
#   }' | python3 -m json.tool

echo "✅ Tests terminés!"
echo ""
echo "💡 Pour tester avec des données réelles:"
echo "1. Assurez-vous d'avoir des mailboxes actives en base: SELECT * FROM mailboxes WHERE is_active = true;"
echo "2. Vérifiez la configuration Microsoft Graph dans system_config"
echo "3. Ajustez les dates selon vos besoins"
echo "4. Utilisez dryRun: true pour tester sans insérer de données"