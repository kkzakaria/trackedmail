-- Migration: Add pause_followups column to mailboxes table
-- This migration adds a column to control follow-up automation per mailbox

-- Add pause_followups column with NOT NULL constraint and default value false
ALTER TABLE mailboxes ADD COLUMN pause_followups BOOLEAN NOT NULL DEFAULT false;

-- Add comment to document the purpose of the new column
COMMENT ON COLUMN mailboxes.pause_followups IS 'When true, disables automatic follow-up sending for this mailbox';