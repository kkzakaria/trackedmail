-- Migration corrective: Ajouter les elements manquants pour le renouvellement des souscriptions
-- Cette migration corrige les elements qui auraient du etre crees par les migrations precedentes
-- mais qui sont absents de la base de production.

-- ============================================
-- 1. Ajouter les colonnes manquantes a webhook_subscriptions
-- ============================================

ALTER TABLE webhook_subscriptions
ADD COLUMN IF NOT EXISTS last_renewal_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_renewal_error TEXT,
ADD COLUMN IF NOT EXISTS renewal_failure_count INTEGER DEFAULT 0;

COMMENT ON COLUMN webhook_subscriptions.last_renewal_attempt_at IS 'Derniere tentative de renouvellement (succes ou echec)';
COMMENT ON COLUMN webhook_subscriptions.last_renewal_error IS 'Message d''erreur de la derniere tentative echouee';
COMMENT ON COLUMN webhook_subscriptions.renewal_failure_count IS 'Nombre d''echecs consecutifs de renouvellement';

-- ============================================
-- 2. Creer l'index pour optimiser les recherches de renouvellement
-- ============================================

DROP INDEX IF EXISTS idx_webhook_subscriptions_needs_renewal;
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_needs_renewal
  ON webhook_subscriptions(expiration_date_time, is_active)
  WHERE is_active = true;

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
-- 4. Vue pour le monitoring de sante des subscriptions
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
-- 5. Configuration systeme pour les URLs (si manquante)
-- ============================================

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
-- 6. Nettoyer et recreer le cron job de renouvellement
-- ============================================

-- Supprimer tous les anciens jobs de renouvellement
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'renew-webhooks') THEN
    PERFORM cron.unschedule('renew-webhooks');
    RAISE NOTICE 'Removed old renew-webhooks job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-renew-webhooks') THEN
    PERFORM cron.unschedule('auto-renew-webhooks');
    RAISE NOTICE 'Removed old auto-renew-webhooks job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-renew-subscriptions') THEN
    PERFORM cron.unschedule('auto-renew-subscriptions');
    RAISE NOTICE 'Removed old auto-renew-subscriptions job for recreation';
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Creer le cron job avec authentification correcte
-- S'execute toutes les 6 heures pour renouveler les subscriptions expirant dans 24h
SELECT cron.schedule(
  'auto-renew-subscriptions',
  '0 */6 * * *',  -- Toutes les 6 heures
  $$
  SELECT net.http_post(
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/microsoft-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Key', get_cron_internal_key()
    ),
    body := jsonb_build_object(
      'action', 'auto-renew',
      'source', 'cron_auto_renew',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 90000
  ) AS request_id;
  $$
);

-- ============================================
-- 7. Marquer les anciennes souscriptions comme inactives
-- ============================================

-- Les souscriptions expirees ne peuvent pas etre renouvelees
-- Il faut en creer de nouvelles
UPDATE webhook_subscriptions
SET is_active = false
WHERE is_active = true
  AND expiration_date_time < NOW();

-- ============================================
-- 8. Documentation et log
-- ============================================

COMMENT ON EXTENSION pg_cron IS
'Scheduler cron - auto-renew-subscriptions s''execute toutes les 6 heures avec X-Internal-Key authentication';

DO $$
BEGIN
  RAISE NOTICE '=== Migration corrective appliquee ===';
  RAISE NOTICE 'Colonnes ajoutees: last_renewal_attempt_at, last_renewal_error, renewal_failure_count';
  RAISE NOTICE 'Vue creee: subscription_health';
  RAISE NOTICE 'Fonction creee: get_subscriptions_needing_renewal()';
  RAISE NOTICE 'Cron job recree: auto-renew-subscriptions (toutes les 6h)';
  RAISE NOTICE 'Souscriptions expirees marquees inactives';
END $$;
