-- Simplification du systeme de renouvellement automatique des subscriptions Microsoft Graph
-- Cette migration ameliore la fiabilite et simplifie la maintenance

-- ============================================
-- 1. Ameliorer la table webhook_subscriptions
-- ============================================

-- Ajouter des colonnes pour mieux gerer les renouvellements
ALTER TABLE webhook_subscriptions
ADD COLUMN IF NOT EXISTS last_renewal_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_renewal_error TEXT,
ADD COLUMN IF NOT EXISTS renewal_failure_count INTEGER DEFAULT 0;

-- Creer un index pour optimiser la recherche des subscriptions a renouveler
DROP INDEX IF EXISTS idx_webhook_subscriptions_expiration;
CREATE INDEX idx_webhook_subscriptions_needs_renewal
  ON webhook_subscriptions(expiration_date_time, is_active)
  WHERE is_active = true;

-- Commentaire pour la documentation
COMMENT ON COLUMN webhook_subscriptions.last_renewal_attempt_at IS 'Derniere tentative de renouvellement (succes ou echec)';
COMMENT ON COLUMN webhook_subscriptions.last_renewal_error IS 'Message d''erreur de la derniere tentative echouee';
COMMENT ON COLUMN webhook_subscriptions.renewal_failure_count IS 'Nombre d''echecs consecutifs de renouvellement';

-- ============================================
-- 2. Simplifier le cron job
-- ============================================

-- Supprimer l'ancien cron job
DO $$
BEGIN
    PERFORM cron.unschedule('auto-renew-webhooks');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('renew-webhooks');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Creer un nouveau cron job qui s'execute toutes les 6 heures (au lieu de 12)
-- Cela donne 4 chances de renouveler avant l'expiration (72h / 6h = 12 executions)
SELECT cron.schedule(
  'auto-renew-subscriptions',
  '0 */6 * * *',  -- Toutes les 6 heures
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/microsoft-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
    ),
    body := jsonb_build_object(
      'action', 'auto-renew',
      'source', 'cron_auto_renew',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 90000
  ) as request_id;
  $$
);

-- ============================================
-- 3. Fonction helper pour verifier les subscriptions a renouveler
-- ============================================

CREATE OR REPLACE FUNCTION public.get_subscriptions_needing_renewal(
  p_hours_before_expiry INTEGER DEFAULT 24
)
RETURNS TABLE (
  subscription_id TEXT,
  mailbox_id UUID,
  expiration_date_time TIMESTAMPTZ,
  hours_until_expiry NUMERIC,
  renewal_count INTEGER,
  last_renewal_attempt_at TIMESTAMPTZ,
  renewal_failure_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ws.subscription_id,
    ws.mailbox_id,
    ws.expiration_date_time,
    EXTRACT(EPOCH FROM (ws.expiration_date_time - NOW())) / 3600 AS hours_until_expiry,
    ws.renewal_count,
    ws.last_renewal_attempt_at,
    ws.renewal_failure_count
  FROM webhook_subscriptions ws
  WHERE ws.is_active = true
    AND ws.expiration_date_time <= (NOW() + INTERVAL '1 hour' * p_hours_before_expiry)
    AND ws.expiration_date_time > NOW()
  ORDER BY ws.expiration_date_time ASC;
END;
$$;

COMMENT ON FUNCTION public.get_subscriptions_needing_renewal IS
'Retourne les subscriptions qui doivent etre renouvelees dans les prochaines X heures';

-- ============================================
-- 4. Vue pour le monitoring
-- ============================================

CREATE OR REPLACE VIEW subscription_health AS
SELECT
  COUNT(*) FILTER (WHERE is_active = true) as active_subscriptions,
  COUNT(*) FILTER (WHERE is_active = true AND expiration_date_time <= NOW() + INTERVAL '24 hours') as expiring_soon_24h,
  COUNT(*) FILTER (WHERE is_active = true AND expiration_date_time <= NOW() + INTERVAL '12 hours') as expiring_soon_12h,
  COUNT(*) FILTER (WHERE is_active = true AND expiration_date_time <= NOW() + INTERVAL '6 hours') as expiring_soon_6h,
  COUNT(*) FILTER (WHERE is_active = true AND expiration_date_time <= NOW()) as expired,
  COUNT(*) FILTER (WHERE is_active = true AND renewal_failure_count > 0) as with_failures,
  COUNT(*) FILTER (WHERE is_active = true AND renewal_failure_count >= 3) as critical_failures,
  AVG(renewal_count) FILTER (WHERE is_active = true) as avg_renewal_count,
  MAX(renewal_count) FILTER (WHERE is_active = true) as max_renewal_count
FROM webhook_subscriptions;

COMMENT ON VIEW subscription_health IS
'Vue pour surveiller la sante globale des subscriptions webhook';

-- ============================================
-- 5. Configuration systeme pour les URLs
-- ============================================

-- Ajouter la configuration des URLs dans system_config si elle n'existe pas
INSERT INTO system_config (key, value, description)
VALUES (
  'microsoft_subscriptions_config',
  jsonb_build_object(
    'renewal_threshold_hours', 24,
    'max_renewal_failures', 3,
    'cron_interval_hours', 6,
    'subscription_duration_hours', 72
  ),
  'Configuration du systeme de renouvellement des subscriptions Microsoft Graph'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 6. Commentaires et documentation
-- ============================================

COMMENT ON TABLE webhook_subscriptions IS
'Subscriptions webhook Microsoft Graph avec gestion automatique du renouvellement';

COMMENT ON INDEX idx_webhook_subscriptions_needs_renewal IS
'Index optimise pour trouver rapidement les subscriptions a renouveler';

COMMENT ON EXTENSION pg_cron IS
'Scheduler cron - auto-renew-subscriptions s''execute toutes les 6 heures pour renouveler les subscriptions expirant dans les 24h';
