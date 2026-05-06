-- Révoque EXECUTE sur les fonctions SECURITY DEFINER exposées via /rest/v1/rpc
-- Corrige les avertissements `anon_security_definer_function_executable` et
-- `authenticated_security_definer_function_executable` du linter Supabase.
--
-- IMPORTANT : Postgres accorde EXECUTE à PUBLIC par défaut sur les fonctions.
-- anon et authenticated héritent de PUBLIC, donc il faut révoquer de PUBLIC
-- (et de anon/authenticated explicitement par sécurité), puis GRANT sélectif.
--
-- Stratégie :
--   1. Fonctions purement internes (triggers, cron, Edge Functions service_role,
--      opérations admin) : tout révoquer. service_role conserve son GRANT existant.
--   2. Helpers RLS appelés depuis les policies : révoquer puis re-GRANT à
--      authenticated (les policies s'exécutent sous le rôle appelant).
--   3. RPC destinées au frontend authentifié : révoquer puis GRANT à authenticated.
--
-- Idempotent : skip silencieux des fonctions absentes (drift local/remote).
--
-- Référence : https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

DO $$
DECLARE
  -- Fonctions internes : aucun rôle public, seul service_role conserve l'accès
  internal_fns text[] := ARRAY[
    -- Triggers
    'public.handle_new_user()',
    'public.handle_user_updated()',
    'public.handle_user_deleted()',
    'public.handle_email_conflict()',
    'public.update_tracked_emails_fts()',
    -- Cron-only (pg_cron tourne en superuser)
    'public.get_cron_internal_key()',
    'public.get_subscriptions_needing_renewal(integer)',
    'public.get_email_cleanup_cron_status()',
    'public.toggle_email_cleanup_cron(boolean)',
    'public.trigger_email_cleanup()',
    'public.cleanup_old_deleted_users(integer)',
    -- Edge Functions (service_role)
    'public.reschedule_pending_followups(uuid, timestamptz, integer)',
    'public.get_total_followup_count(uuid)',
    -- Sync / admin
    'public.sync_user_to_auth()',
    'public.sync_all_users_from_auth()',
    'public.enable_user_sync()',
    'public.disable_user_sync()',
    'public.soft_delete_user(uuid)',
    'public.hard_delete_user(uuid)',
    'public.restore_user(uuid)'
  ];
  -- Fonctions accessibles à authenticated (helpers RLS + RPC frontend)
  authenticated_fns text[] := ARRAY[
    -- Helpers RLS (utilisés dans les policies)
    'public.is_admin()',
    'public.is_manager_or_admin()',
    'public.current_user_role()',
    'public.current_user_mailbox_ids()',
    'public.can_access_followup(uuid)',
    'public.is_user_deleted(uuid)',
    -- RPC frontend
    'public.archive_tracked_email(uuid, text)',
    'public.search_tracked_emails(text)',
    'public.get_dashboard_stats()'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    ELSE
      RAISE NOTICE 'Skipping missing function: %', fn;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY authenticated_fns LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    ELSE
      RAISE NOTICE 'Skipping missing function: %', fn;
    END IF;
  END LOOP;
END $$;
