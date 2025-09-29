/**
 * Types partagés pour Microsoft Auth Edge Function
 */

import { createClient } from '@supabase/supabase-js'

export type EdgeSupabaseClient = ReturnType<typeof createClient>

/**
 * Interface pour la configuration d'authentification
 */
export interface AuthConfig {
  clientId: string
  clientSecret: string
  tenantId: string
  scopes: string[]
}

/**
 * Interface pour les requêtes de token
 */
export interface TokenRequest {
  action: 'acquire' | 'refresh' | 'validate' | 'revoke'
  scopes?: string[]
  token?: string
}

/**
 * Interface pour les réponses de token
 */
export interface TokenResponse {
  success: boolean
  access_token?: string
  expires_in?: number
  expires_at?: string
  error?: string
  code?: string
}

/**
 * Interface pour le statut des tokens
 */
export interface TokenStatus {
  type: string
  scope: string
  isExpired: boolean
  expiresInMinutes: number
  lastRefreshed: string
  created: string
}

/**
 * Interface pour les statistiques des tokens
 */
export interface TokenStats {
  totalTokens: number
  validTokens: number
  expiringSoon: number
  lastRefresh?: string
}

/**
 * Scopes par défaut pour Microsoft Graph
 */
export const DEFAULT_SCOPES = [
  'https://graph.microsoft.com/.default'
]