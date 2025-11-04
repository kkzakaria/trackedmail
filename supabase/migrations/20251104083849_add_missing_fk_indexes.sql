-- Migration: Add Missing Foreign Key Indexes
-- Description: Create indexes on foreign key columns to improve join performance
-- Fixes: Supabase advisor warning 0001_unindexed_foreign_keys

BEGIN;

-- Index on followup_templates.created_by
-- Foreign key: followup_templates_created_by_fkey -> users.id
CREATE INDEX IF NOT EXISTS idx_followup_templates_created_by
  ON public.followup_templates USING btree (created_by);

COMMENT ON INDEX idx_followup_templates_created_by IS
  'Performance index for FK followup_templates.created_by -> users.id';

-- Index on followups.template_id
-- Foreign key: followups_template_id_fkey -> followup_templates.id
CREATE INDEX IF NOT EXISTS idx_followups_template_id
  ON public.followups USING btree (template_id);

COMMENT ON INDEX idx_followups_template_id IS
  'Performance index for FK followups.template_id -> followup_templates.id';

-- Index on system_config.updated_by
-- Foreign key: system_config_updated_by_fkey -> users.id
CREATE INDEX IF NOT EXISTS idx_system_config_updated_by
  ON public.system_config USING btree (updated_by);

COMMENT ON INDEX idx_system_config_updated_by IS
  'Performance index for FK system_config.updated_by -> users.id';

-- Index on user_mailbox_assignments.assigned_by
-- Foreign key: user_mailbox_assignments_assigned_by_fkey -> users.id
CREATE INDEX IF NOT EXISTS idx_user_mailbox_assignments_assigned_by
  ON public.user_mailbox_assignments USING btree (assigned_by);

COMMENT ON INDEX idx_user_mailbox_assignments_assigned_by IS
  'Performance index for FK user_mailbox_assignments.assigned_by -> users.id';

-- Index on user_mailbox_assignments.mailbox_id
-- Foreign key: user_mailbox_assignments_mailbox_id_fkey -> mailboxes.id
CREATE INDEX IF NOT EXISTS idx_user_mailbox_assignments_mailbox_id
  ON public.user_mailbox_assignments USING btree (mailbox_id);

COMMENT ON INDEX idx_user_mailbox_assignments_mailbox_id IS
  'Performance index for FK user_mailbox_assignments.mailbox_id -> mailboxes.id';

COMMIT;
