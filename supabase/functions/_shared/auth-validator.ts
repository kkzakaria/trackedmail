/**
 * Shared Authentication Validator for Edge Functions
 *
 * Provides unified authentication for internal Edge Functions called by cron jobs
 * Supports two authentication methods:
 * 1. Bearer token (service_role_key) - For direct API calls
 * 2. X-Internal-Key - For cron jobs and internal function calls
 */

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_INTERNAL_KEY = Deno.env.get('CRON_INTERNAL_KEY') || 'default-dev-key-change-in-production'

/**
 * Validates the authentication of an incoming request
 * @param req - The incoming HTTP request
 * @returns true if authentication is valid, false otherwise
 */
export function validateInternalKey(req: Request): boolean {
  const authHeader = req.headers.get('Authorization')
  const internalKey = req.headers.get('X-Internal-Key')

  // Option 1: Bearer token (service_role_key)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return token === SUPABASE_SERVICE_ROLE_KEY
  }

  // Option 2: X-Internal-Key for cron jobs
  if (internalKey && internalKey === CRON_INTERNAL_KEY) {
    return true
  }

  return false
}

/**
 * Returns a 401 Unauthorized response for invalid authentication
 */
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({
    success: false,
    error: 'Unauthorized - invalid authentication'
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 401
  })
}