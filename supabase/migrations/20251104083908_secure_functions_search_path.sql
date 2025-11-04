-- Migration: Secure Functions with SECURITY DEFINER and SET search_path
-- Description: Add security definer and explicit search_path to prevent SQL injection
-- Fixes: Supabase advisor warning 0011_function_search_path_mutable

BEGIN;

-- 1. Secure update_tracked_emails_fts() trigger function
CREATE OR REPLACE FUNCTION public.update_tracked_emails_fts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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

COMMENT ON FUNCTION public.update_tracked_emails_fts IS
  'Secured trigger function to automatically update FTS columns on INSERT/UPDATE. Uses SECURITY DEFINER with explicit search_path.';

-- 2. Secure search_tracked_emails() search function
CREATE OR REPLACE FUNCTION public.search_tracked_emails(search_query TEXT)
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
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
  FROM public.tracked_emails te
  WHERE
    te.fts_en @@ websearch_to_tsquery('english', search_query)
    OR te.fts_fr @@ websearch_to_tsquery('french', search_query)
  ORDER BY relevance DESC;
END;
$$;

COMMENT ON FUNCTION public.search_tracked_emails IS
  'Secured search function for tracked emails in both English and French with relevance ranking. Uses SECURITY DEFINER with explicit search_path.';

COMMIT;
