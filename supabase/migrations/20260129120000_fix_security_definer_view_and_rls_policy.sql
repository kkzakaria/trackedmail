-- Fix 1: Recréer la vue subscription_health avec SECURITY INVOKER
-- La vue était définie avec SECURITY DEFINER par défaut, ce qui permet
-- aux utilisateurs d'accéder aux données sous-jacentes avec les privilèges du créateur.
CREATE OR REPLACE VIEW subscription_health
WITH (security_invoker = true) AS
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

-- Fix 2: Remplacer la politique RLS INSERT trop permissive sur manual_followups
-- L'ancienne politique WITH CHECK (true) permettait à n'importe quel rôle d'insérer.
-- On restreint maintenant les insertions au rôle service_role uniquement.
DROP POLICY IF EXISTS "manual_followups_insert_policy" ON manual_followups;

CREATE POLICY "manual_followups_insert_policy"
ON manual_followups FOR INSERT
TO service_role
WITH CHECK (true);
