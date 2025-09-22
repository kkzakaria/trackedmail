-- Migration: Test Helpers Setup for Supabase Authentication
-- This migration sets up test helpers for creating authenticated users in tests and seed data

-- =============================================
-- 1. Create tests schema
-- =============================================
CREATE SCHEMA IF NOT EXISTS tests;

-- =============================================
-- 2. Create table for storing test user identifiers
-- =============================================
CREATE TABLE IF NOT EXISTS tests.user_identifiers (
    identifier TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. Function to create Supabase users for testing
-- =============================================
CREATE OR REPLACE FUNCTION tests.create_supabase_user(
    user_identifier TEXT,
    email TEXT,
    password TEXT DEFAULT 'test123456',
    user_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
    existing_user_id UUID;
BEGIN
    -- Check if user already exists by identifier
    SELECT ui.user_id INTO existing_user_id
    FROM tests.user_identifiers ui
    WHERE ui.identifier = user_identifier;

    IF existing_user_id IS NOT NULL THEN
        RETURN existing_user_id;
    END IF;

    -- Generate a deterministic UUID based on email for consistency
    new_user_id := gen_random_uuid();

    -- Insert into auth.users (simulated for testing)
    -- Note: In real Supabase, this would be handled by auth service
    -- For local development, we insert directly to simulate the auth user
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        raw_user_meta_data,
        raw_app_meta_data,
        encrypted_password,
        email_confirmed_at,
        phone_confirmed_at,
        confirmation_sent_at,
        recovery_sent_at,
        email_change_sent_at,
        created_at,
        updated_at,
        aud,
        role
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        email,
        user_metadata,
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        crypt(password, gen_salt('bf')),
        NOW(),
        NULL,
        NOW(),
        NULL,
        NULL,
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
    ) ON CONFLICT (id) DO NOTHING;

    -- Store the association identifier → user_id
    INSERT INTO tests.user_identifiers (identifier, user_id)
    VALUES (user_identifier, new_user_id)
    ON CONFLICT (identifier) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        created_at = NOW();

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. Function to get Supabase user ID by identifier
-- =============================================
CREATE OR REPLACE FUNCTION tests.get_supabase_uid(user_identifier TEXT)
RETURNS UUID AS $$
DECLARE
    user_id UUID;
BEGIN
    SELECT ui.user_id INTO user_id
    FROM tests.user_identifiers ui
    WHERE ui.identifier = user_identifier;

    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Test user with identifier "%" not found. Make sure to create it first with tests.create_supabase_user()', user_identifier;
    END IF;

    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. Function to authenticate as a test user
-- =============================================
CREATE OR REPLACE FUNCTION tests.authenticate_as(user_identifier TEXT)
RETURNS UUID AS $$
DECLARE
    user_id UUID;
BEGIN
    user_id := tests.get_supabase_uid(user_identifier);

    -- Set the current user context for testing
    -- This simulates being logged in as this user
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', user_id::text,
        'role', 'authenticated',
        'aud', 'authenticated'
    )::text, true);

    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. Function to clear authentication (simulate logout)
-- =============================================
CREATE OR REPLACE FUNCTION tests.clear_authentication()
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', NULL, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 7. Function to authenticate as service role (bypass RLS)
-- =============================================
CREATE OR REPLACE FUNCTION tests.authenticate_as_service_role()
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object(
        'role', 'service_role'
    )::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 8. Utility function to clean up test users
-- =============================================
CREATE OR REPLACE FUNCTION tests.cleanup_test_users()
RETURNS VOID AS $$
BEGIN
    -- Delete test users from auth.users
    DELETE FROM auth.users
    WHERE id IN (SELECT user_id FROM tests.user_identifiers);

    -- Clear the identifiers table
    DELETE FROM tests.user_identifiers;

    -- Clear any remaining public.users entries
    DELETE FROM public.users
    WHERE id NOT IN (SELECT id FROM auth.users);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 9. Grant necessary permissions
-- =============================================
GRANT USAGE ON SCHEMA tests TO postgres, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA tests TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA tests TO postgres;

-- Allow the functions to be called during seeding
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO postgres;

-- =============================================
-- Test helpers setup completed
-- =============================================
COMMENT ON SCHEMA tests IS 'Schema containing test helper functions for Supabase authentication testing';
COMMENT ON FUNCTION tests.create_supabase_user IS 'Creates a test user in auth.users with specified metadata';
COMMENT ON FUNCTION tests.get_supabase_uid IS 'Retrieves the UUID of a test user by identifier';
COMMENT ON FUNCTION tests.authenticate_as IS 'Simulates authentication as a specific test user';
COMMENT ON FUNCTION tests.clear_authentication IS 'Clears the current authentication context';
COMMENT ON FUNCTION tests.authenticate_as_service_role IS 'Authenticates as service role to bypass RLS';
COMMENT ON FUNCTION tests.cleanup_test_users IS 'Removes all test users and cleans up the database';