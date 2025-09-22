-- Migration: Enable pgcrypto Extension for Password Hashing
-- Description: Enable PostgreSQL pgcrypto extension to provide gen_salt() function
-- Required for: test helper functions that use bcrypt password hashing
-- Fixes: "function gen_salt(unknown) does not exist" error during database reset

-- Enable pgcrypto extension for cryptographic functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add security comment
COMMENT ON EXTENSION pgcrypto IS 'Cryptographic functions required for secure password hashing in test helpers and user management functions';

-- Success message
SELECT 'pgcrypto extension enabled successfully - gen_salt() function now available' as status;