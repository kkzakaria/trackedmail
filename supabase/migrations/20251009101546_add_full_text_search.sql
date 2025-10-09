-- Migration: Add Full Text Search support for tracked_emails
-- Features:
--   - Bilingual search (English + French)
--   - Multi-column search with weighted ranking
--   - GIN index for fast search performance
--   - Automatic update via triggers

-- 1. Add FTS columns for English and French (nullable, updated by trigger)
ALTER TABLE tracked_emails ADD COLUMN fts_en tsvector;
ALTER TABLE tracked_emails ADD COLUMN fts_fr tsvector;

-- 2. Create trigger function to update FTS columns
CREATE OR REPLACE FUNCTION update_tracked_emails_fts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Build English FTS vector with weighted columns
  NEW.fts_en :=
    setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body_preview, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body_content, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.sender_email, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.recipient_emails, ' '), '')), 'D') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.cc_emails, ' '), '')), 'D');

  -- Build French FTS vector with weighted columns
  NEW.fts_fr :=
    setweight(to_tsvector('french', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.body_preview, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.body_content, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(NEW.sender_email, '')), 'D') ||
    setweight(to_tsvector('french', coalesce(array_to_string(NEW.recipient_emails, ' '), '')), 'D') ||
    setweight(to_tsvector('french', coalesce(array_to_string(NEW.cc_emails, ' '), '')), 'D');

  RETURN NEW;
END;
$$;

-- 3. Create trigger to auto-update FTS columns on INSERT/UPDATE
CREATE TRIGGER tracked_emails_fts_update
  BEFORE INSERT OR UPDATE OF subject, body_preview, body_content, sender_email, recipient_emails, cc_emails
  ON tracked_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_tracked_emails_fts();

-- 4. Populate FTS columns for existing rows
UPDATE tracked_emails SET updated_at = updated_at;

-- 5. Create GIN indexes for fast full-text search
CREATE INDEX tracked_emails_fts_en_idx ON tracked_emails USING gin (fts_en);
CREATE INDEX tracked_emails_fts_fr_idx ON tracked_emails USING gin (fts_fr);

-- 6. Create search function with automatic language detection
CREATE OR REPLACE FUNCTION search_tracked_emails(search_query TEXT)
RETURNS TABLE (
  id UUID,
  subject TEXT,
  sender_email TEXT,
  body_preview TEXT,
  sent_at TIMESTAMPTZ,
  status TEXT,
  relevance REAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    te.id,
    te.subject,
    te.sender_email,
    te.body_preview,
    te.sent_at,
    te.status,
    GREATEST(
      ts_rank(te.fts_en, websearch_to_tsquery('english', search_query)),
      ts_rank(te.fts_fr, websearch_to_tsquery('french', search_query))
    ) AS relevance
  FROM tracked_emails te
  WHERE
    te.fts_en @@ websearch_to_tsquery('english', search_query)
    OR te.fts_fr @@ websearch_to_tsquery('french', search_query)
  ORDER BY relevance DESC;
END;
$$;

-- 7. Add comments for documentation
COMMENT ON COLUMN tracked_emails.fts_en IS 'Full-text search vector for English content (weighted: A=subject, B=body_preview, C=body_content, D=emails)';
COMMENT ON COLUMN tracked_emails.fts_fr IS 'Full-text search vector for French content (weighted: A=subject, B=body_preview, C=body_content, D=emails)';
COMMENT ON FUNCTION update_tracked_emails_fts IS 'Trigger function to automatically update FTS columns on INSERT/UPDATE';
COMMENT ON FUNCTION search_tracked_emails IS 'Search tracked emails in both English and French with relevance ranking';
