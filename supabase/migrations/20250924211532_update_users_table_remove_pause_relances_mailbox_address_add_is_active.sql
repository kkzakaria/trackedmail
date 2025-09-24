-- Migration: Remove pause_relances and mailbox_address columns, add is_active column
-- This migration cleans up the users table by removing unused columns and adding
-- a more appropriate is_active column for user status management

-- =============================================
-- 1. First, handle dependencies by updating views and functions
-- =============================================

-- Drop and recreate the active_users view without pause_relances
DROP VIEW IF EXISTS public.active_users;

-- Add the new is_active column BEFORE dropping pause_relances to avoid breaking triggers
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Migrate existing data: pause_relances = true means is_active = false
UPDATE users SET is_active = NOT pause_relances WHERE pause_relances IS NOT NULL;

-- Create new active_users view with is_active instead of pause_relances
CREATE OR REPLACE VIEW public.active_users AS
SELECT
    id,
    email,
    full_name,
    role,
    timezone,
    is_active,
    created_at,
    updated_at
FROM public.users
WHERE deleted_at IS NULL;

-- Grant permissions on the updated view
GRANT SELECT ON public.active_users TO authenticated, anon;

-- =============================================
-- 2. Update trigger functions to use is_active instead of pause_relances
-- =============================================

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert new user into public.users with data from auth.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        timezone,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'utilisateur'),
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'Europe/Paris'),
        COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true),
        NEW.created_at,
        NEW.updated_at
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = EXCLUDED.updated_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update handle_user_updated function
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Update existing user in public.users with new data from auth.users
    UPDATE public.users SET
        email = NEW.email,
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
        role = COALESCE(NEW.raw_user_meta_data->>'role', role),
        timezone = COALESCE(NEW.raw_user_meta_data->>'timezone', timezone),
        is_active = COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, is_active),
        updated_at = NEW.updated_at
    WHERE id = NEW.id AND deleted_at IS NULL;

    -- If no rows were updated (user might be soft deleted), log it
    IF NOT FOUND THEN
        RAISE NOTICE 'User % not updated in public.users - may be soft deleted or not exist', NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update sync_user_to_auth function
CREATE OR REPLACE FUNCTION public.sync_user_to_auth()
RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
    updated_metadata JSONB;
BEGIN
    -- Skip if user is being soft deleted
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get current metadata from auth.users
    SELECT COALESCE(raw_user_meta_data, '{}'::jsonb) INTO current_metadata
    FROM auth.users
    WHERE id = NEW.id;

    -- Build updated metadata preserving existing fields
    updated_metadata := current_metadata
        || jsonb_build_object(
            'full_name', NEW.full_name,
            'role', NEW.role,
            'timezone', NEW.timezone,
            'is_active', NEW.is_active
        );

    -- Update auth.users with new metadata
    UPDATE auth.users SET
        raw_user_meta_data = updated_metadata,
        updated_at = NOW()
    WHERE id = NEW.id;

    IF NOT FOUND THEN
        RAISE NOTICE 'Could not update auth.users metadata for user %', NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update sync_all_users_from_auth function
CREATE OR REPLACE FUNCTION public.sync_all_users_from_auth()
RETURNS INTEGER AS $$
DECLARE
    synced_count INTEGER := 0;
    auth_user RECORD;
BEGIN
    -- Temporarily disable triggers to avoid recursion
    PERFORM public.disable_user_sync();

    -- Sync all users from auth.users to public.users
    FOR auth_user IN
        SELECT id, email, raw_user_meta_data, created_at, updated_at
        FROM auth.users
    LOOP
        INSERT INTO public.users (
            id,
            email,
            full_name,
            role,
            timezone,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            auth_user.id,
            auth_user.email,
            COALESCE(auth_user.raw_user_meta_data->>'full_name', SPLIT_PART(auth_user.email, '@', 1)),
            COALESCE(auth_user.raw_user_meta_data->>'role', 'utilisateur'),
            COALESCE(auth_user.raw_user_meta_data->>'timezone', 'Europe/Paris'),
            COALESCE((auth_user.raw_user_meta_data->>'is_active')::boolean, true),
            auth_user.created_at,
            auth_user.updated_at
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            timezone = EXCLUDED.timezone,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at;

        synced_count := synced_count + 1;
    END LOOP;

    -- Re-enable triggers
    PERFORM public.enable_user_sync();

    RAISE NOTICE 'Synced % users from auth.users to public.users', synced_count;
    RETURN synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. Update the trigger condition to check for is_active changes
-- =============================================

-- Drop and recreate the trigger with updated condition
DROP TRIGGER IF EXISTS on_public_user_updated ON public.users;

CREATE TRIGGER on_public_user_updated
    AFTER UPDATE ON public.users
    FOR EACH ROW
    WHEN (
        OLD.full_name IS DISTINCT FROM NEW.full_name OR
        OLD.role IS DISTINCT FROM NEW.role OR
        OLD.timezone IS DISTINCT FROM NEW.timezone OR
        OLD.is_active IS DISTINCT FROM NEW.is_active
    )
    EXECUTE FUNCTION public.sync_user_to_auth();

-- =============================================
-- 4. Now safely remove old columns
-- =============================================

-- Remove old columns that are no longer needed
ALTER TABLE users DROP COLUMN IF EXISTS pause_relances;
ALTER TABLE users DROP COLUMN IF EXISTS mailbox_address;

-- =============================================
-- 5. Add comment to document the purpose of the new column
-- =============================================
COMMENT ON COLUMN users.is_active IS 'Indicates whether the user account is active and can perform operations';