-- Migration: Add Trigram Search support and optimize FTS
-- Features:
--   - Enable pg_trgm extension for partial/fuzzy matching
--   - Remove body_content from FTS (performance optimization)
--   - Create trigram GIN indexes for ILIKE acceleration
--   - Support partial word search ("factu" finds "Facturation")
--   - Support email partial search ("maersk" finds "ci.import@maersk.com")

-- 1. Enable pg_trgm extension for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Update FTS trigger function to remove body_content (performance)
CREATE OR REPLACE FUNCTION update_tracked_emails_fts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Build English FTS vector (WITHOUT body_content for better performance)
  -- Weighted: A=subject (highest), B=body_preview, C=emails
  NEW.fts_en :=
    setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body_preview, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.sender_email, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.recipient_emails, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.cc_emails, ' '), '')), 'C');

  -- Build French FTS vector (WITHOUT body_content for better performance)
  -- Weighted: A=subject (highest), B=body_preview, C=emails
  NEW.fts_fr :=
    setweight(to_tsvector('french', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.body_preview, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.sender_email, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(array_to_string(NEW.recipient_emails, ' '), '')), 'C') ||
    setweight(to_tsvector('french', coalesce(array_to_string(NEW.cc_emails, ' '), '')), 'C');

  RETURN NEW;
END;
$$;

-- 3. Rebuild FTS columns for existing rows (triggers auto-update)
UPDATE tracked_emails SET updated_at = updated_at;

-- 4. Create trigram GIN indexes for fast ILIKE partial search
-- These indexes accelerate ILIKE '%pattern%' queries using trigram matching
CREATE INDEX IF NOT EXISTS tracked_emails_subject_trgm_idx
  ON tracked_emails USING gin (subject gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tracked_emails_body_preview_trgm_idx
  ON tracked_emails USING gin (body_preview gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tracked_emails_sender_email_trgm_idx
  ON tracked_emails USING gin (sender_email gin_trgm_ops);

-- 5. Update column comments to reflect changes
COMMENT ON COLUMN tracked_emails.fts_en IS 'Full-text search vector for English content (weighted: A=subject, B=body_preview, C=emails) - body_content excluded for performance';
COMMENT ON COLUMN tracked_emails.fts_fr IS 'Full-text search vector for French content (weighted: A=subject, B=body_preview, C=emails) - body_content excluded for performance';

-- 6. Add comments for new indexes
COMMENT ON INDEX tracked_emails_subject_trgm_idx IS 'Trigram GIN index for partial/fuzzy search on subject using ILIKE';
COMMENT ON INDEX tracked_emails_body_preview_trgm_idx IS 'Trigram GIN index for partial/fuzzy search on body_preview using ILIKE';
COMMENT ON INDEX tracked_emails_sender_email_trgm_idx IS 'Trigram GIN index for partial/fuzzy search on sender_email using ILIKE';
