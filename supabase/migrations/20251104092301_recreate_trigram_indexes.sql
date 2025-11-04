-- Migration: Recreate Trigram Indexes After pg_trgm Recreation
-- Description: Recreate trigram GIN indexes after pg_trgm extension was enabled in extensions schema
-- Dependencies: Requires pg_trgm extension to be enabled in extensions schema via Dashboard
--
-- PREREQUISITE: Before running this migration, you MUST have:
-- 1. Applied migration 20251104092232_prepare_pg_trgm_recreation.sql
-- 2. Enabled pg_trgm extension via Supabase Dashboard � Database � Extensions
-- 3. Verified pg_trgm is in extensions schema:
--    SELECT extname, nspname FROM pg_extension e
--    JOIN pg_namespace n ON e.extnamespace = n.oid
--    WHERE extname = 'pg_trgm';

BEGIN;

-- =====================================================
-- Enable pg_trgm Extension in Extensions Schema
-- =====================================================
-- For production: This should be done via Supabase Dashboard
-- For local dev: We create it directly in the extensions schema

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Verify installation
DO $$
BEGIN
  -- Verify pg_trgm is in extensions schema
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'extensions'
  ) THEN
    RAISE NOTICE 'pg_trgm extension correctly installed in extensions schema';
  ELSE
    RAISE WARNING 'pg_trgm extension is not in extensions schema';
  END IF;
END $$;

-- =====================================================
-- Recreate Trigram GIN Indexes
-- =====================================================

-- These indexes accelerate ILIKE '%pattern%' queries using trigram matching
-- Supports partial/fuzzy search on tracked_emails table

CREATE INDEX IF NOT EXISTS tracked_emails_subject_trgm_idx
  ON public.tracked_emails USING gin (subject extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tracked_emails_body_preview_trgm_idx
  ON public.tracked_emails USING gin (body_preview extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tracked_emails_sender_email_trgm_idx
  ON public.tracked_emails USING gin (sender_email extensions.gin_trgm_ops);

-- =====================================================
-- Add Index Comments
-- =====================================================

COMMENT ON INDEX tracked_emails_subject_trgm_idx IS
  'Trigram GIN index for partial/fuzzy search on subject using ILIKE (recreated after pg_trgm moved to extensions schema)';

COMMENT ON INDEX tracked_emails_body_preview_trgm_idx IS
  'Trigram GIN index for partial/fuzzy search on body_preview using ILIKE (recreated after pg_trgm moved to extensions schema)';

COMMENT ON INDEX tracked_emails_sender_email_trgm_idx IS
  'Trigram GIN index for partial/fuzzy search on sender_email using ILIKE (recreated after pg_trgm moved to extensions schema)';

COMMIT;
