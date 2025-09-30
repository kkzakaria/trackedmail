#!/bin/bash
# Script de déploiement des Edge Functions avec authentification X-Internal-Key
# Usage: ./scripts/deploy-auth-functions.sh

set -e

echo "🚀 Déploiement des Edge Functions avec X-Internal-Key"
echo "======================================================"

# Couleurs pour les logs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonctions à déployer
FUNCTIONS=("followup-processor" "followup-maintenance" "bounce-processor")

echo ""
echo "${YELLOW}⚠️  IMPORTANT : Vérifications préalables${NC}"
echo "1. Avez-vous configuré CRON_INTERNAL_KEY dans les secrets ? (supabase secrets list)"
echo "2. Avez-vous inséré la clé dans system_config ? (SELECT get_cron_internal_key();)"
echo ""
read -p "Continuer ? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "${RED}❌ Déploiement annulé${NC}"
    exit 1
fi

echo ""
echo "${YELLOW}📦 Déploiement des fonctions avec --no-verify-jwt...${NC}"
echo ""

# Déployer chaque fonction
for func in "${FUNCTIONS[@]}"
do
    echo "${YELLOW}Déploiement de ${func}...${NC}"
    if supabase functions deploy "$func" --no-verify-jwt; then
        echo "${GREEN}✅ ${func} déployée avec succès${NC}"
    else
        echo "${RED}❌ Erreur lors du déploiement de ${func}${NC}"
        exit 1
    fi
    echo ""
done

echo ""
echo "${GREEN}🎉 Déploiement terminé avec succès !${NC}"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Vérifier les cron jobs : SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'followup%';"
echo "2. Tester manuellement avec curl (voir PRODUCTION-DEPLOYMENT-GUIDE.md)"
echo "3. Surveiller les logs : Dashboard > Edge Functions > Logs"
echo ""