-- Migration: Add Soft Delete Support for Users
-- This migration adds soft delete functionality to the users table

-- =============================================
-- 1. Add deleted_at column for soft delete
-- =============================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- =============================================
-- 2. Create index for performance on deleted_at
-- =============================================
CREATE INDEX IF NOT EXISTS idx_users_deleted_at
ON public.users (deleted_at)
WHERE deleted_at IS NOT NULL;

-- Create index for active users (deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_users_active
ON public.users (id, email)
WHERE deleted_at IS NULL;

-- =============================================
-- 3. Create utility functions for soft delete management
-- =============================================

-- Function to soft delete a user
CREATE OR REPLACE FUNCTION public.soft_delete_user(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    UPDATE public.users
    SET
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft deleted user
CREATE OR REPLACE FUNCTION public.restore_user(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    UPDATE public.users
    SET
        deleted_at = NULL,
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NOT NULL;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to permanently delete a user (hard delete)
CREATE OR REPLACE FUNCTION public.hard_delete_user(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    rows_deleted INTEGER;
BEGIN
    DELETE FROM public.users WHERE id = user_id;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN rows_deleted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user is deleted
CREATE OR REPLACE FUNCTION public.is_user_deleted(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_deleted BOOLEAN;
BEGIN
    SELECT (deleted_at IS NOT NULL) INTO is_deleted
    FROM public.users
    WHERE id = user_id;

    RETURN COALESCE(is_deleted, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. Create view for active users (exclude soft deleted)
-- =============================================
CREATE OR REPLACE VIEW public.active_users AS
SELECT
    id,
    email,
    full_name,
    role,
    mailbox_address,
    timezone,
    pause_relances,
    created_at,
    updated_at
FROM public.users
WHERE deleted_at IS NULL;

-- =============================================
-- 5. Update existing RLS policies to exclude soft deleted users
-- =============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins and managers can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;

-- Recreate policies with soft delete consideration
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT
USING (
    auth.uid() = id
    AND deleted_at IS NULL
);

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
USING (
    auth.uid() = id
    AND deleted_at IS NULL
);

CREATE POLICY "Admins and managers can view all users"
ON public.users FOR SELECT
USING (
    deleted_at IS NULL
    AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('administrateur', 'manager')
        AND deleted_at IS NULL
    )
);

CREATE POLICY "Admins can manage all users"
ON public.users FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'administrateur'
        AND deleted_at IS NULL
    )
);

-- =============================================
-- 6. Update mailbox-related policies to handle soft deleted users
-- =============================================

-- Update user_mailbox_assignments policies
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.user_mailbox_assignments;
DROP POLICY IF EXISTS "Managers and admins can manage assignments" ON public.user_mailbox_assignments;

CREATE POLICY "Users can view their own assignments"
ON public.user_mailbox_assignments FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('manager', 'administrateur')
        AND deleted_at IS NULL
    )
);

CREATE POLICY "Managers and admins can manage assignments"
ON public.user_mailbox_assignments FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('manager', 'administrateur')
        AND deleted_at IS NULL
    )
);

-- =============================================
-- 7. Create function to clean up soft deleted users (maintenance)
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_deleted_users(
    older_than_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Permanently delete users that have been soft deleted for more than X days
    WITH deleted_users AS (
        DELETE FROM public.users
        WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '1 day' * older_than_days
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted_users;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================
-- 8. Grant permissions
-- =============================================
GRANT SELECT ON public.active_users TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_deleted TO authenticated;

-- Only admins can hard delete and cleanup
GRANT EXECUTE ON FUNCTION public.hard_delete_user TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_old_deleted_users TO postgres;

-- =============================================
-- Comments and documentation
-- =============================================
COMMENT ON COLUMN public.users.deleted_at IS 'Timestamp when the user was soft deleted. NULL means user is active.';
COMMENT ON VIEW public.active_users IS 'View containing only non-deleted users';
COMMENT ON FUNCTION public.soft_delete_user IS 'Soft deletes a user by setting deleted_at timestamp';
COMMENT ON FUNCTION public.restore_user IS 'Restores a soft deleted user by clearing deleted_at';
COMMENT ON FUNCTION public.hard_delete_user IS 'Permanently deletes a user from the database';
COMMENT ON FUNCTION public.is_user_deleted IS 'Checks if a user is soft deleted';
COMMENT ON FUNCTION public.cleanup_old_deleted_users IS 'Permanently removes users soft deleted longer than specified days';