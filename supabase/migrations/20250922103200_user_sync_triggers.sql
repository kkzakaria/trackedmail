-- Migration: User Synchronization Triggers
-- This migration creates triggers to synchronize auth.users with public.users

-- =============================================
-- 1. Function to handle new user creation (auth.users → public.users)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert new user into public.users with data from auth.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        mailbox_address,
        timezone,
        pause_relances,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'utilisateur'),
        NEW.email, -- Default mailbox address to email
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'Europe/Paris'),
        COALESCE((NEW.raw_user_meta_data->>'pause_relances')::boolean, false),
        NEW.created_at,
        NEW.updated_at
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = EXCLUDED.updated_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. Function to handle user updates (auth.users → public.users)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Update existing user in public.users with new data from auth.users
    UPDATE public.users SET
        email = NEW.email,
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
        role = COALESCE(NEW.raw_user_meta_data->>'role', role),
        timezone = COALESCE(NEW.raw_user_meta_data->>'timezone', timezone),
        pause_relances = COALESCE((NEW.raw_user_meta_data->>'pause_relances')::boolean, pause_relances),
        updated_at = NEW.updated_at
    WHERE id = NEW.id AND deleted_at IS NULL;

    -- If no rows were updated (user might be soft deleted), log it
    IF NOT FOUND THEN
        RAISE NOTICE 'User % not updated in public.users - may be soft deleted or not exist', NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. Function to handle user deletion (auth.users → public.users)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
    -- Soft delete the user in public.users
    UPDATE public.users SET
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = OLD.id AND deleted_at IS NULL;

    -- Log the soft deletion
    RAISE NOTICE 'User % soft deleted from public.users', OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. Function to sync changes from public.users back to auth.users
-- =============================================
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
            'pause_relances', NEW.pause_relances
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

-- =============================================
-- 5. Function to handle email conflicts during user creation
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_email_conflict()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_id UUID;
BEGIN
    -- Check if email already exists with different ID
    SELECT id INTO existing_user_id
    FROM public.users
    WHERE email = NEW.email
    AND id != NEW.id
    AND deleted_at IS NULL;

    IF existing_user_id IS NOT NULL THEN
        -- Log the conflict
        RAISE NOTICE 'Email conflict detected: % already exists for user %', NEW.email, existing_user_id;

        -- Option 1: Update existing user instead of creating new one
        UPDATE public.users SET
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
            role = COALESCE(NEW.raw_user_meta_data->>'role', role),
            updated_at = NOW()
        WHERE id = existing_user_id;

        -- Prevent the new insertion
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. Create triggers on auth.users
-- =============================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Create triggers for auth.users changes
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*)
    EXECUTE FUNCTION public.handle_user_updated();

CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_deleted();

-- =============================================
-- 7. Create triggers on public.users for reverse sync
-- =============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_public_user_updated ON public.users;

-- Create trigger for public.users changes (reverse sync)
CREATE TRIGGER on_public_user_updated
    AFTER UPDATE ON public.users
    FOR EACH ROW
    WHEN (
        OLD.full_name IS DISTINCT FROM NEW.full_name OR
        OLD.role IS DISTINCT FROM NEW.role OR
        OLD.timezone IS DISTINCT FROM NEW.timezone OR
        OLD.pause_relances IS DISTINCT FROM NEW.pause_relances
    )
    EXECUTE FUNCTION public.sync_user_to_auth();

-- =============================================
-- 8. Create trigger for handling email conflicts during auth user creation
-- =============================================

-- This trigger runs BEFORE the main insert trigger to handle conflicts
CREATE TRIGGER before_auth_user_created_conflict_check
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_email_conflict();

-- =============================================
-- 9. Utility functions for managing sync
-- =============================================

-- Function to disable user sync temporarily (for bulk operations)
CREATE OR REPLACE FUNCTION public.disable_user_sync()
RETURNS VOID AS $$
BEGIN
    ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
    ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_updated;
    ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_deleted;
    ALTER TABLE public.users DISABLE TRIGGER on_public_user_updated;

    RAISE NOTICE 'User synchronization triggers disabled';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to re-enable user sync
CREATE OR REPLACE FUNCTION public.enable_user_sync()
RETURNS VOID AS $$
BEGIN
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_updated;
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_deleted;
    ALTER TABLE public.users ENABLE TRIGGER on_public_user_updated;

    RAISE NOTICE 'User synchronization triggers enabled';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to manually sync all users from auth.users to public.users
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
            mailbox_address,
            timezone,
            pause_relances,
            created_at,
            updated_at
        ) VALUES (
            auth_user.id,
            auth_user.email,
            COALESCE(auth_user.raw_user_meta_data->>'full_name', SPLIT_PART(auth_user.email, '@', 1)),
            COALESCE(auth_user.raw_user_meta_data->>'role', 'utilisateur'),
            auth_user.email,
            COALESCE(auth_user.raw_user_meta_data->>'timezone', 'Europe/Paris'),
            COALESCE((auth_user.raw_user_meta_data->>'pause_relances')::boolean, false),
            auth_user.created_at,
            auth_user.updated_at
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            timezone = EXCLUDED.timezone,
            pause_relances = EXCLUDED.pause_relances,
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
-- 10. Grant permissions
-- =============================================
GRANT EXECUTE ON FUNCTION public.disable_user_sync TO postgres;
GRANT EXECUTE ON FUNCTION public.enable_user_sync TO postgres;
GRANT EXECUTE ON FUNCTION public.sync_all_users_from_auth TO postgres;

-- =============================================
-- Comments and documentation
-- =============================================
COMMENT ON FUNCTION public.handle_new_user IS 'Trigger function that syncs new users from auth.users to public.users';
COMMENT ON FUNCTION public.handle_user_updated IS 'Trigger function that syncs user updates from auth.users to public.users';
COMMENT ON FUNCTION public.handle_user_deleted IS 'Trigger function that soft deletes users in public.users when deleted from auth.users';
COMMENT ON FUNCTION public.sync_user_to_auth IS 'Trigger function that syncs changes from public.users back to auth.users metadata';
COMMENT ON FUNCTION public.handle_email_conflict IS 'Trigger function that handles email conflicts during user creation';
COMMENT ON FUNCTION public.disable_user_sync IS 'Utility function to temporarily disable user synchronization triggers';
COMMENT ON FUNCTION public.enable_user_sync IS 'Utility function to re-enable user synchronization triggers';
COMMENT ON FUNCTION public.sync_all_users_from_auth IS 'Utility function to manually sync all users from auth.users to public.users';

-- =============================================
-- User synchronization triggers are now active
-- =============================================
SELECT 'User synchronization triggers installed and active' AS status;