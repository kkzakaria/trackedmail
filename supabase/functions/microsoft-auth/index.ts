/**
 * Edge Function - Microsoft Graph Token Management
 *
 * Architecture modulaire pour la gestion des tokens Microsoft Graph
 * - Acquisition et renouvellement de tokens
 * - Chiffrement et stockage sécurisé
 * - Monitoring et statistiques
 * - Validation et révocation
 */

import { createClient } from '@supabase/supabase-js'
import {
  EdgeSupabaseClient,
  TokenRequest
} from './shared-types.ts'
import { acquireToken, refreshToken, validateToken, revokeTokens } from './token-manager.ts'
import { getTokenStatus, getTokenStats } from './status-manager.ts'

console.log('🚀 Microsoft Graph Token Manager - Ready!')

/**
 * Handler principal de l'Edge Function
 */
Deno.serve(async (req) => {
  // Configuration Supabase
  const supabase: EdgeSupabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // CORS headers pour les requêtes cross-origin
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  // Vérification de la méthode HTTP
  if (!['POST', 'GET'].includes(req.method)) {
    console.warn(`[REQUEST] Method not allowed: ${req.method}`)
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  console.log(`[REQUEST] ${req.method} token management request received`)

  try {
    // Route les requêtes selon la méthode
    if (req.method === 'GET') {
      return await handleGetRequest(req, supabase, corsHeaders)
    } else {
      return await handlePostRequest(req, supabase, corsHeaders)
    }

  } catch (error) {
    console.error('❌ Error in token management:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Gère les requêtes GET (status, stats)
 */
async function handleGetRequest(
  req: Request,
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  console.log(`[GET] Processing action: ${action}`)

  try {
    switch (action) {
      case 'status': {
        const result = await getTokenStatus(supabase)
        return new Response(
          JSON.stringify(result),
          {
            status: result.success ? 200 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      case 'stats': {
        const result = await getTokenStats(supabase)
        return new Response(
          JSON.stringify(result),
          {
            status: result.success ? 200 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action for GET request. Valid actions: status, stats' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }
  } catch (error) {
    console.error(`❌ Error handling GET request for action ${action}:`, error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process GET request',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * Gère les requêtes POST (acquire, refresh, validate, revoke)
 */
async function handlePostRequest(
  req: Request,
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Vérification de l'authentification
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[AUTH] Missing or invalid authorization header')
    return new Response(
      JSON.stringify({ success: false, error: 'Missing or invalid authorization header' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Parse le payload
    const tokenRequest: TokenRequest = await req.json()
    console.log(`[POST] Processing action: ${tokenRequest.action}`)

    // Route selon l'action
    let result
    switch (tokenRequest.action) {
      case 'acquire':
        result = await acquireToken(supabase, tokenRequest)
        break
      case 'refresh':
        result = await refreshToken(supabase, tokenRequest)
        break
      case 'validate':
        result = validateToken(tokenRequest)
        break
      case 'revoke':
        result = await revokeTokens(supabase)
        break
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action. Valid actions: acquire, refresh, validate, revoke' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error handling POST request:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process POST request',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}











