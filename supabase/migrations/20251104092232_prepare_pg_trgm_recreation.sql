-- Migration: Prepare pg_trgm Recreation in Correct Schema
-- Description: Drop pg_trgm from public schema to allow recreation in extensions schema via Dashboard
-- Reference: https://supabase.com/docs/guides/database/extensions
-- Fixes: Supabase advisor warning 0014_extension_in_public
--
-- IMPORTANT: After this migration, you MUST:
-- 1. Go to Supabase Dashboard -> Database -> Extensions
-- 2. Enable "pg_trgm" extension (it will be created in 'extensions' schema automatically)
-- 3. Run migration 20251104092233_recreate_trigram_indexes.sql to recreate trigram indexes

BEGIN;

-- =====================================================
-- 1. Drop Trigram Indexes (depend on pg_trgm extension)
-- =====================================================

DROP INDEX IF EXISTS public.tracked_emails_subject_trgm_idx;
DROP INDEX IF EXISTS public.tracked_emails_body_preview_trgm_idx;
DROP INDEX IF EXISTS public.tracked_emails_sender_email_trgm_idx;

-- =====================================================
-- 2. Drop pg_trgm Extension
-- =====================================================
-- This will drop the extension from the public schema
-- After this migration, recreate it via Supabase Dashboard in extensions schema

DROP EXTENSION IF EXISTS pg_trgm CASCADE;

-- =====================================================
-- NEXT STEPS (MANUAL)
-- =====================================================
-- After applying this migration:
-- 1. Go to Supabase Dashboard -> Database -> Extensions
-- 2. Enable "pg_trgm" extension
-- 3. Verify it was created in extensions schema with:
--    SELECT extname, nspname FROM pg_extension e
--    JOIN pg_namespace n ON e.extnamespace = n.oid
--    WHERE extname = 'pg_trgm';
--    (should show: pg_trgm | extensions)
-- 4. Apply next migration to recreate trigram indexes

COMMIT;
