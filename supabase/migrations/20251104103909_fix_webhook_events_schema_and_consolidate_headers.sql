-- Migration: Fix webhook_events schema and consolidate message_headers
-- Description:
--   1. Align webhook_events with TypeScript schema
--   2. Consolidate message_headers to include email_bounces  
--   3. Handle missing processing_stats table

-- =====================================================
-- 1. FIX WEBHOOK_EVENTS SCHEMA
-- =====================================================
-- Current SQL schema doesn't match TypeScript types
-- Code tries to insert: source, event_type, payload, headers, notification_count
-- But table has: subscription_id, change_type, resource_data, client_state, processed

COMMENT ON TABLE public.webhook_events IS
  'Raw webhook notifications received from Microsoft Graph for audit trail and debugging';

-- Add missing columns used by TypeScript code
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'microsoft_graph',
  ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'notification_received',
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS headers JSONB,
  ADD COLUMN IF NOT EXISTS notification_count INTEGER DEFAULT 0;

-- Update column comments
COMMENT ON COLUMN public.webhook_events.source IS
  'Source of the webhook (always microsoft_graph for this system)';
COMMENT ON COLUMN public.webhook_events.event_type IS
  'Type of event (notification_received, validation, etc.)';
COMMENT ON COLUMN public.webhook_events.payload IS
  'Complete webhook payload as received from Microsoft Graph';
COMMENT ON COLUMN public.webhook_events.headers IS
  'HTTP headers from the webhook request (User-Agent, X-Forwarded-For, etc.)';
COMMENT ON COLUMN public.webhook_events.notification_count IS
  'Number of notifications in the batch payload';

-- Old columns kept for compatibility and detailed analysis
COMMENT ON COLUMN public.webhook_events.subscription_id IS
  'Microsoft Graph subscription ID (kept for backward compatibility)';
COMMENT ON COLUMN public.webhook_events.change_type IS
  'Type of change (created, updated, deleted) - kept for backward compatibility';
COMMENT ON COLUMN public.webhook_events.resource_data IS
  'Resource data from notification - kept for backward compatibility';

-- Make old columns nullable as new code doesn't write to them
ALTER TABLE public.webhook_events
  ALTER COLUMN subscription_id DROP NOT NULL,
  ALTER COLUMN change_type DROP NOT NULL,
  ALTER COLUMN resource_data DROP NOT NULL;

-- =====================================================
-- 2. CONSOLIDATE MESSAGE_HEADERS
-- =====================================================
-- Add column to reference email_bounces
-- This allows message_headers to be used for ALL email types:
--   - tracked_emails (tracked outgoing emails)
--   - email_responses (received responses)
--   - email_bounces (NDR/bounces)

ALTER TABLE public.message_headers
  ADD COLUMN IF NOT EXISTS email_bounce_id UUID REFERENCES public.email_bounces(id) ON DELETE CASCADE;

-- Create index for bounce lookups
CREATE INDEX IF NOT EXISTS idx_message_headers_email_bounce_id
  ON public.message_headers(email_bounce_id)
  WHERE email_bounce_id IS NOT NULL;

-- Update table and column comments
COMMENT ON TABLE public.message_headers IS
  'Email headers storage for tracked emails, responses, and bounces - used for auto-response detection and NDR analysis';

COMMENT ON COLUMN public.message_headers.tracked_email_id IS
  'Reference to tracked outgoing email (nullable - mutually exclusive with email_response_id and email_bounce_id)';

COMMENT ON COLUMN public.message_headers.email_response_id IS
  'Reference to email response (nullable - mutually exclusive with tracked_email_id and email_bounce_id)';

COMMENT ON COLUMN public.message_headers.email_bounce_id IS
  'Reference to email bounce/NDR (nullable - mutually exclusive with tracked_email_id and email_response_id)';

-- Add CHECK constraint to ensure exactly ONE of 3 IDs is defined
ALTER TABLE public.message_headers
  DROP CONSTRAINT IF EXISTS message_headers_exactly_one_reference,
  ADD CONSTRAINT message_headers_exactly_one_reference CHECK (
    (
      CASE WHEN tracked_email_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN email_response_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN email_bounce_id IS NOT NULL THEN 1 ELSE 0 END
    ) = 1
  );

-- =====================================================
-- 3. MIGRATE EXISTING BOUNCE HEADERS (if any exist)
-- =====================================================
-- If email_bounces.ndr_headers contains data, we could migrate it
-- to message_headers, but for now we keep both systems
-- because ndr_headers stores ALL headers in compact JSONB

-- Future option: Create function to migrate ndr_headers to message_headers
-- For now, keep ndr_headers in JSONB for bounces because:
--   1. Bounces can have many headers
--   2. JSONB format is more compact
--   3. We can add conversion function later if needed

COMMENT ON COLUMN public.email_bounces.ndr_headers IS
  'Complete NDR headers as JSONB - kept for compact storage. Important headers can also be stored in message_headers table via email_bounce_id for consistent querying.';

-- =====================================================
-- 4. ENABLE RLS ON WEBHOOK_EVENTS (if not already done)
-- =====================================================
-- Check and enable RLS if needed
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'webhook_events' AND relnamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

    -- Policy to allow administrators to view webhook events
    CREATE POLICY "Admins can view webhook events"
      ON public.webhook_events
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role = 'administrateur'
        )
      );
  END IF;
END $$;

-- =====================================================
-- 5. CLEANUP WEBHOOK_EVENTS OLD DATA (if needed)
-- =====================================================
-- If old data exists with old format, we keep it
-- as it doesn't interfere and can be useful for historical analysis

-- Create indexes to improve search performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_source_event_type
  ON public.webhook_events(source, event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_events_notification_count
  ON public.webhook_events(notification_count)
  WHERE notification_count > 0;
