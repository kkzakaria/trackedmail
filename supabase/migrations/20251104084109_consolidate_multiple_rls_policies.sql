-- Migration: Consolidate Multiple Permissive RLS Policies
-- Description: Merge multiple SELECT policies on email_bounces into single policy for better performance
-- Fixes: Supabase advisor warning 0006_multiple_permissive_policies

BEGIN;

-- =====================================================
-- EMAIL_BOUNCES - Consolidate two SELECT policies into one
-- =====================================================

-- Drop the two separate policies
DROP POLICY IF EXISTS "Users can view bounces for their assigned mailboxes" ON public.email_bounces;
DROP POLICY IF EXISTS "Managers can view all bounces" ON public.email_bounces;

-- Create single consolidated policy with OR logic
CREATE POLICY "View bounces based on role and mailbox assignment"
  ON public.email_bounces
  FOR SELECT
  TO authenticated
  USING (
    -- Managers and admins can view all bounces
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid())
      AND role IN ('administrateur', 'manager')
    )
    OR
    -- Regular users can view bounces for their assigned mailboxes
    tracked_email_id IN (
      SELECT te.id
      FROM public.tracked_emails te
      JOIN public.mailboxes m ON te.mailbox_id = m.id
      JOIN public.user_mailbox_assignments uma ON m.id = uma.mailbox_id
      WHERE uma.user_id = (SELECT auth.uid())
    )
  );

COMMENT ON POLICY "View bounces based on role and mailbox assignment" ON email_bounces IS
  'Consolidated policy combining manager and user access rules. Improves performance by avoiding multiple policy evaluations. Uses (SELECT auth.uid()) for query caching.';

-- =====================================================
-- Verification: Check policy consolidation
-- =====================================================

-- This migration reduces the number of SELECT policies on email_bounces from 2 to 1
-- Expected outcome:
-- - Managers and admins: Can view all bounces (same as before)
-- - Regular users: Can view bounces for their assigned mailboxes (same as before)
-- - Performance: Single policy evaluation instead of two separate evaluations

COMMIT;
