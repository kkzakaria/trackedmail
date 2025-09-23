/**
 * Edge Function - Microsoft Graph Token Management
 *
 * Gère l'authentification, le refresh et le chiffrement des tokens Microsoft Graph
 * Fournit des endpoints sécurisés pour la gestion des tokens d'accès
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { ClientSecretCredential } from 'npm:@azure/identity@4'
import {
  EdgeSupabaseClient
} from '../_shared/types.ts'
import {
  encryptData,
  decryptData,
  serializeEncryptedData,
  deserializeEncryptedData,
  EncryptionError
} from '../_shared/encryption.ts'

console.log('Microsoft Graph Token Manager - Ready!')

/**
 * Interface pour la configuration d'authentification
 */
interface AuthConfig {
  clientId: string
  clientSecret: string
  tenantId: string
  scopes: string[]
}

/**
 * Interface pour les requêtes de token
 */
interface TokenRequest {
  action: 'acquire' | 'refresh' | 'validate' | 'revoke'
  scopes?: string[]
  token?: string
}

/**
 * Interface pour les réponses de token
 */
interface TokenResponse {
  success: boolean
  access_token?: string
  expires_in?: number
  expires_at?: string
  error?: string
  code?: string
}

/**
 * Scopes par défaut pour Microsoft Graph
 * Note: Pour les Application Permissions (client credentials flow),
 * nous devons utiliser .default au lieu de scopes individuels
 */
const DEFAULT_SCOPES = [
  'https://graph.microsoft.com/.default'
]

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
    return new Response('ok', { headers: corsHeaders })
  }

  // Seules les requêtes POST et GET sont autorisées
  if (!['POST', 'GET'].includes(req.method)) {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Route les requêtes selon la méthode
    if (req.method === 'GET') {
      return await handleGetRequest(req, supabase, corsHeaders)
    } else {
      return await handlePostRequest(req, supabase, corsHeaders)
    }

  } catch (error) {
    console.error('Error in token management:', error)

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

  switch (action) {
    case 'status':
      return await getTokenStatus(supabase, corsHeaders)
    case 'stats':
      return await getTokenStats(supabase, corsHeaders)
    default:
      return new Response(
        JSON.stringify({ error: 'Invalid action for GET request' }),
        {
          status: 400,
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
  // Vérification de l'authentification (optionnel selon le use case)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing or invalid authorization header' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  // Parse le payload
  const tokenRequest: TokenRequest = await req.json()

  // Route selon l'action
  switch (tokenRequest.action) {
    case 'acquire':
      return await acquireToken(supabase, tokenRequest, corsHeaders)
    case 'refresh':
      return await refreshToken(supabase, tokenRequest, corsHeaders)
    case 'validate':
      return validateToken(supabase, tokenRequest, corsHeaders)
    case 'revoke':
      return await revokeTokens(supabase, corsHeaders)
    default:
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
  }
}

/**
 * Acquiert un nouveau token d'accès
 */
async function acquireToken(
  supabase: EdgeSupabaseClient,
  request: TokenRequest,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    console.log('Acquiring new Microsoft Graph token...')

    const authConfig = getAuthConfig()
    const scopes = request.scopes || DEFAULT_SCOPES

    const credential = new ClientSecretCredential(
      authConfig.tenantId,
      authConfig.clientId,
      authConfig.clientSecret
    )

    const tokenResponse = await credential.getToken(scopes)

    if (!tokenResponse) {
      throw new Error('Failed to acquire access token')
    }

    const expiresAt = new Date(tokenResponse.expiresOnTimestamp)
    const expiresIn = Math.floor((tokenResponse.expiresOnTimestamp - Date.now()) / 1000)

    // Chiffrer et stocker le token
    const encryptedToken = await encryptToken(tokenResponse.token)
    await storeToken(supabase, encryptedToken, expiresAt, scopes)

    const response: TokenResponse = {
      success: true,
      access_token: tokenResponse.token,
      expires_in: expiresIn,
      expires_at: expiresAt.toISOString()
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error acquiring token:', error)

    const response: TokenResponse = {
      success: false,
      error: 'Failed to acquire token',
      code: 'TOKEN_ACQUISITION_FAILED'
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * Renouvelle un token existant
 */
async function refreshToken(
  supabase: EdgeSupabaseClient,
  request: TokenRequest,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    console.log('Refreshing Microsoft Graph token...')

    // Pour les Application Permissions, on acquiert simplement un nouveau token
    // car il n'y a pas de refresh token avec ce type d'authentification
    return await acquireToken(supabase, request, corsHeaders)

  } catch (error) {
    console.error('Error refreshing token:', error)

    const response: TokenResponse = {
      success: false,
      error: 'Failed to refresh token',
      code: 'TOKEN_REFRESH_FAILED'
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * Valide un token existant
 */
function validateToken(
  _supabase: EdgeSupabaseClient,
  request: TokenRequest,
  corsHeaders: Record<string, string>
): Response {
  try {
    if (!request.token) {
      throw new Error('Token is required for validation')
    }

    const isValid = isTokenValid(request.token)

    const response: TokenResponse = {
      success: isValid,
      ...(isValid ? {} : { error: 'Token is invalid or expired', code: 'TOKEN_INVALID' })
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error validating token:', error)

    const response: TokenResponse = {
      success: false,
      error: 'Failed to validate token',
      code: 'TOKEN_VALIDATION_FAILED'
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * Révoque tous les tokens stockés
 */
async function revokeTokens(
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    console.log('Revoking all stored tokens...')

    const { error } = await supabase
      .from('microsoft_graph_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (error) {
      throw error
    }

    const response: TokenResponse = {
      success: true
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error revoking tokens:', error)

    const response: TokenResponse = {
      success: false,
      error: 'Failed to revoke tokens',
      code: 'TOKEN_REVOCATION_FAILED'
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * Récupère le statut des tokens
 */
async function getTokenStatus(
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const { data: tokens, error } = await supabase
      .from('microsoft_graph_tokens')
      .select('token_type, expires_at, scope, last_refreshed_at, created_at')

    if (error) {
      throw error
    }

    const now = new Date()
    const tokenStatus = tokens?.map((token: {
      token_type: string;
      expires_at: string;
      scope: string;
      last_refreshed_at: string;
      created_at: string;
    }) => {
      const expiresAt = new Date(token.expires_at)
      const isExpired = expiresAt <= now
      const expiresInMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60))

      return {
        type: token.token_type,
        scope: token.scope,
        isExpired,
        expiresInMinutes: isExpired ? 0 : expiresInMinutes,
        lastRefreshed: token.last_refreshed_at,
        created: token.created_at
      }
    }) || []

    return new Response(
      JSON.stringify({
        success: true,
        tokens: tokenStatus
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error getting token status:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get token status'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * Récupère les statistiques des tokens
 */
async function getTokenStats(
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const { data: tokens, error } = await supabase
      .from('microsoft_graph_tokens')
      .select('expires_at, last_refreshed_at')

    if (error) {
      throw error
    }

    const now = new Date()
    const thresholdMs = 30 * 60 * 1000 // 30 minutes

    let validTokens = 0
    let expiringSoon = 0
    let lastRefresh: string | undefined

    for (const token of tokens || []) {
      const expiresAt = new Date(token.expires_at)
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()

      if (timeUntilExpiry > 0) {
        validTokens++

        if (timeUntilExpiry <= thresholdMs) {
          expiringSoon++
        }
      }

      if (!lastRefresh || new Date(token.last_refreshed_at) > new Date(lastRefresh)) {
        lastRefresh = token.last_refreshed_at
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalTokens: tokens?.length || 0,
          validTokens,
          expiringSoon,
          lastRefresh
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error getting token stats:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get token stats'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * Récupère la configuration d'authentification
 */
function getAuthConfig(): AuthConfig {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Microsoft Graph credentials not configured')
  }

  return {
    clientId,
    clientSecret,
    tenantId,
    scopes: DEFAULT_SCOPES
  }
}

/**
 * Encrypt a token using robust AES-256-GCM encryption
 *
 * @param token - The plaintext token to encrypt
 * @returns Promise<string> - Serialized encrypted data for storage
 */
async function encryptToken(token: string): Promise<string> {
  try {
    const encrypted = await encryptData(token)
    return serializeEncryptedData(encrypted)
  } catch (error) {
    console.error('Token encryption failed:', error)
    throw new Error('Failed to encrypt token')
  }
}

/**
 * Decrypt a token using robust AES-256-GCM decryption
 *
 * @param encryptedToken - The serialized encrypted token data
 * @returns Promise<string> - The decrypted plaintext token
 */
async function decryptToken(encryptedToken: string): Promise<string> {
  try {
    const encrypted = deserializeEncryptedData(encryptedToken)
    return await decryptData(encrypted)
  } catch (error) {
    console.error('Token decryption failed:', error)
    throw new Error('Failed to decrypt token')
  }
}

/**
 * Stocke un token de manière sécurisée
 */
async function storeToken(
  supabase: EdgeSupabaseClient,
  encryptedToken: string,
  expiresAt: Date,
  scopes: string[]
): Promise<void> {
  // D'abord, supprimer les tokens existants
  await supabase
    .from('microsoft_graph_tokens')
    .delete()
    .eq('token_type', 'bearer')

  // Ensuite, insérer le nouveau token
  const { error } = await supabase
    .from('microsoft_graph_tokens')
    .insert({
      token_type: 'bearer',
      encrypted_token: encryptedToken,
      expires_at: expiresAt.toISOString(),
      scope: scopes.join(' '),
      last_refreshed_at: new Date().toISOString()
    })

  if (error) {
    throw error
  }
}

/**
 * Vérifie si un token est valide
 */
function isTokenValid(token: string): boolean {
  try {
    // Vérification que le token n'est pas vide
    if (!token || token.trim() === '') {
      return false
    }

    // Vérification basique de la structure du token JWT
    const parts = token.split('.')
    if (parts.length !== 3) {
      return false
    }

    // Vérifier que chaque partie n'est pas vide
    if (!parts[0] || !parts[1] || !parts[2]) {
      return false
    }

    // Décoder le payload pour vérifier l'expiration
    const payload = JSON.parse(atob(parts[1]))
    const exp = payload.exp

    if (!exp) {
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    return exp > now
  } catch (error) {
    console.warn('Error validating token structure:', error)
    return false
  }
}