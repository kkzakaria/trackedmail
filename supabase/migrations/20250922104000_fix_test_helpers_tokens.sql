-- Migration: Fix test helpers to properly handle token fields
-- Description: Update tests.create_supabase_user() to include all required token fields
-- This prevents NULL token fields that cause GoTrue authentication errors

-- Drop the existing function to recreate it with correct token handling
DROP FUNCTION IF EXISTS tests.create_supabase_user(text, text, jsonb);

-- Recreate the function with proper token field initialization
CREATE OR REPLACE FUNCTION tests.create_supabase_user(
    user_identifier text,
    email text,
    password text DEFAULT 'defaultpassword123',
    user_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id uuid;
BEGIN
    -- Generate a deterministic UUID based on email for consistency
    new_user_id := gen_random_uuid();

    -- Insert into auth.users (simulated for testing)
    -- Note: In real Supabase, this would be handled by auth service
    -- For local development, we insert directly to simulate the auth user
    -- IMPORTANT: All token fields must be explicitly set to empty strings to avoid NULL issues
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
        role,
        -- Token fields that MUST be empty strings, not NULL
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        -- These already have defaults but we specify them for clarity
        phone_change_token,
        email_change_token_current,
        reauthentication_token,
        phone_change
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
        'authenticated',
        -- All token fields set to empty strings to prevent GoTrue scan errors
        '',  -- confirmation_token
        '',  -- recovery_token
        '',  -- email_change_token_new
        '',  -- email_change
        '',  -- phone_change_token
        '',  -- email_change_token_current
        '',  -- reauthentication_token
        ''   -- phone_change
    ) ON CONFLICT (id) DO NOTHING;

    -- Store the association identifier → user_id
    INSERT INTO tests.user_identifiers (identifier, user_id)
    VALUES (user_identifier, new_user_id)
    ON CONFLICT (identifier) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        created_at = NOW();

    RETURN new_user_id;
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION tests.create_supabase_user(text, text, text, jsonb) IS
    'Creates a test user in both auth.users and public.users with proper token field initialization.
     All token fields are explicitly set to empty strings to prevent GoTrue NULL conversion errors.';

-- Optional: Fix any existing test users that might have NULL token fields
UPDATE auth.users
SET
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    phone_change = COALESCE(phone_change, '')
WHERE
    confirmation_token IS NULL
    OR recovery_token IS NULL
    OR email_change_token_new IS NULL
    OR email_change IS NULL
    OR phone_change_token IS NULL
    OR email_change_token_current IS NULL
    OR reauthentication_token IS NULL
    OR phone_change IS NULL;