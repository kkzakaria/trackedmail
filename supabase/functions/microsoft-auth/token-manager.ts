/**
 * Gestionnaire de tokens Microsoft Graph
 * Responsable de l'acquisition, validation et stockage sécurisé des tokens
 */

import { ClientSecretCredential } from '@azure/identity'
import {
  encryptData,
  decryptData,
  serializeEncryptedData,
  deserializeEncryptedData
} from '../_shared/encryption.ts'
import {
  EdgeSupabaseClient,
  AuthConfig,
  TokenRequest,
  TokenResponse,
  DEFAULT_SCOPES
} from './shared-types.ts'

/**
 * Acquiert un nouveau token d'accès
 */
export async function acquireToken(
  supabase: EdgeSupabaseClient,
  request: TokenRequest
): Promise<TokenResponse> {
  try {
    console.log('🔑 Acquiring new Microsoft Graph token...')

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

    console.log('✅ Token acquired and stored successfully')

    return {
      success: true,
      access_token: tokenResponse.token,
      expires_in: expiresIn,
      expires_at: expiresAt.toISOString()
    }

  } catch (error) {
    console.error('❌ Error acquiring token:', error)

    return {
      success: false,
      error: 'Failed to acquire token',
      code: 'TOKEN_ACQUISITION_FAILED'
    }
  }
}

/**
 * Renouvelle un token existant
 */
export async function refreshToken(
  supabase: EdgeSupabaseClient,
  request: TokenRequest
): Promise<TokenResponse> {
  try {
    console.log('🔄 Refreshing Microsoft Graph token...')

    // Pour les Application Permissions, on acquiert simplement un nouveau token
    // car il n'y a pas de refresh token avec ce type d'authentification
    return await acquireToken(supabase, request)

  } catch (error) {
    console.error('❌ Error refreshing token:', error)

    return {
      success: false,
      error: 'Failed to refresh token',
      code: 'TOKEN_REFRESH_FAILED'
    }
  }
}

/**
 * Valide un token existant
 */
export function validateToken(request: TokenRequest): TokenResponse {
  try {
    if (!request.token) {
      throw new Error('Token is required for validation')
    }

    const isValid = isTokenValid(request.token)

    return {
      success: isValid,
      ...(isValid ? {} : { error: 'Token is invalid or expired', code: 'TOKEN_INVALID' })
    }

  } catch (error) {
    console.error('❌ Error validating token:', error)

    return {
      success: false,
      error: 'Failed to validate token',
      code: 'TOKEN_VALIDATION_FAILED'
    }
  }
}

/**
 * Révoque tous les tokens stockés
 */
export async function revokeTokens(supabase: EdgeSupabaseClient): Promise<TokenResponse> {
  try {
    console.log('🗑️ Revoking all stored tokens...')

    const { error } = await supabase
      .from('microsoft_graph_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (error) {
      throw error
    }

    console.log('✅ All tokens revoked successfully')

    return { success: true }

  } catch (error) {
    console.error('❌ Error revoking tokens:', error)

    return {
      success: false,
      error: 'Failed to revoke tokens',
      code: 'TOKEN_REVOCATION_FAILED'
    }
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
 * Chiffre un token de manière sécurisée
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
 * Déchiffre un token
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
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
  const { error } = await (supabase as any)
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