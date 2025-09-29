/**
 * Gestionnaire de statut et statistiques des tokens
 * Responsable du monitoring et de la récupération d'informations sur les tokens
 */

import {
  EdgeSupabaseClient,
  TokenStatus,
  TokenStats
} from './shared-types.ts'

/**
 * Récupère le statut détaillé des tokens
 */
export async function getTokenStatus(supabase: EdgeSupabaseClient): Promise<{
  success: boolean
  tokens?: TokenStatus[]
  error?: string
}> {
  try {
    console.log('📊 Retrieving token status...')

    const { data: tokens, error } = await supabase
      .from('microsoft_graph_tokens')
      .select('token_type, expires_at, scope, last_refreshed_at, created_at')

    if (error) {
      throw error
    }

    const now = new Date()
    const tokenStatus = tokens?.map((token: any) => {
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

    console.log(`✅ Retrieved status for ${tokenStatus.length} tokens`)

    return {
      success: true,
      tokens: tokenStatus
    }

  } catch (error) {
    console.error('❌ Error getting token status:', error)

    return {
      success: false,
      error: 'Failed to get token status'
    }
  }
}

/**
 * Récupère les statistiques générales des tokens
 */
export async function getTokenStats(supabase: EdgeSupabaseClient): Promise<{
  success: boolean
  stats?: TokenStats
  error?: string
}> {
  try {
    console.log('📈 Calculating token statistics...')

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
      const expiresAt = new Date((token as any).expires_at)
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()

      if (timeUntilExpiry > 0) {
        validTokens++

        if (timeUntilExpiry <= thresholdMs) {
          expiringSoon++
        }
      }

      if (!lastRefresh || new Date((token as any).last_refreshed_at) > new Date(lastRefresh)) {
        lastRefresh = (token as any).last_refreshed_at
      }
    }

    const stats: TokenStats = {
      totalTokens: tokens?.length || 0,
      validTokens,
      expiringSoon,
      lastRefresh
    }

    console.log(`✅ Token stats calculated: ${stats.validTokens}/${stats.totalTokens} valid`)

    return {
      success: true,
      stats
    }

  } catch (error) {
    console.error('❌ Error getting token stats:', error)

    return {
      success: false,
      error: 'Failed to get token stats'
    }
  }
}