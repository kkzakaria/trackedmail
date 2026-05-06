-- Suivi de 20260506120018_revoke_execute_security_definer_functions.sql
--
-- Renforce la posture de sécurité avec trois mécanismes :
--   1. GRANT EXECUTE explicite à service_role sur les fonctions internes
--      (defense in depth contre une éventuelle évolution des chaînes de
--      privilèges par défaut de Supabase).
--   2. Lock-down des helpers RLS test-only `is_service_role` et
--      `get_bounce_mailbox_id` qui existent uniquement en environnement
--      local (drift). Skip silencieux en production.
--   3. Assertion de couverture : aucune fonction SECURITY DEFINER du schéma
--      public ne doit rester exécutable par anon. Échoue la migration si
--      l'invariant est violé → catch des renames silencieux et nouvelles
--      fonctions oubliées par la migration précédente.
--
-- Section 4 (audit informatif) : log les fonctions encore accessibles à
-- authenticated dans les logs de déploiement, pour faciliter les revues.

-- ============================================================================
-- 1. GRANT EXECUTE explicite à service_role sur les fonctions internes
-- ============================================================================

DO $$
DECLARE
  internal_fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.handle_user_updated()',
    'public.handle_user_deleted()',
    'public.handle_email_conflict()',
    'public.update_tracked_emails_fts()',
    'public.get_cron_internal_key()',
    'public.get_subscriptions_needing_renewal(integer)',
    'public.get_email_cleanup_cron_status()',
    'public.toggle_email_cleanup_cron(boolean)',
    'public.trigger_email_cleanup()',
    'public.cleanup_old_deleted_users(integer)',
    'public.reschedule_pending_followups(uuid, timestamptz, integer)',
    'public.get_total_followup_count(uuid)',
    'public.sync_user_to_auth()',
    'public.sync_all_users_from_auth()',
    'public.enable_user_sync()',
    'public.disable_user_sync()',
    'public.soft_delete_user(uuid)',
    'public.hard_delete_user(uuid)',
    'public.restore_user(uuid)'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 2. Lock-down des helpers RLS test-only (local uniquement, no-op en prod)
-- ============================================================================

DO $$
DECLARE
  test_helper_fns text[] := ARRAY[
    'public.is_service_role()',
    'public.get_bounce_mailbox_id(uuid)'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY test_helper_fns LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 3. Assertion de couverture (échec dur si l'invariant est violé)
-- ============================================================================

DO $$
DECLARE
  vulnerable_fns text[];
BEGIN
  SELECT array_agg(
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    ORDER BY p.proname
  )
  INTO vulnerable_fns
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND has_function_privilege('anon', p.oid, 'EXECUTE') = true;

  IF vulnerable_fns IS NOT NULL AND array_length(vulnerable_fns, 1) > 0 THEN
    RAISE EXCEPTION
      'Sécurité : % fonction(s) SECURITY DEFINER de public restent exécutables par anon : %',
      array_length(vulnerable_fns, 1), vulnerable_fns
      USING HINT = 'Créer une migration avec REVOKE EXECUTE ... FROM PUBLIC, anon pour chaque fonction listée.';
  END IF;
END $$;

-- ============================================================================
-- 4. Audit informatif : fonctions exposées à authenticated
-- ============================================================================

DO $$
DECLARE
  authenticated_fns text[];
  cnt integer;
BEGIN
  SELECT
    array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' ORDER BY p.proname),
    count(*)
  INTO authenticated_fns, cnt
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE') = true;

  RAISE NOTICE
    'Fonctions SECURITY DEFINER exposées à authenticated (% au total) : %',
    cnt, COALESCE(authenticated_fns, ARRAY[]::text[]);
END $$;
