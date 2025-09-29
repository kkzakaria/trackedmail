/**
 * Gestionnaire de monitoring et maintenance des abonnements
 * Responsable du suivi de la santé des abonnements et du nettoyage
 */

import {
  EdgeSupabaseClient,
  SubscriptionHealth,
  SUBSCRIPTION_CONFIG
} from './shared-types.ts'

/**
 * Liste les abonnements avec filtres optionnels
 */
export async function listSubscriptions(
  supabase: EdgeSupabaseClient,
  mailboxId?: string | null
): Promise<{
  success: boolean
  subscriptions?: Array<{
    id: string
    subscription_id: string
    resource: string
    change_type: string
    notification_url: string
    expiration_date_time: string
    mailbox_id: string
    include_resource_data: boolean
    is_active: boolean
    renewal_count: number
    created_at: string
    last_renewed_at?: string
    mailboxes?: {
      email_address: string
      display_name: string
    }
  }>
  error?: string
}> {
  try {
    console.log(`📋 Listing subscriptions${mailboxId ? ` for mailbox ${mailboxId}` : ' (all)'}`)

    let query = supabase
      .from('webhook_subscriptions')
      .select(`
        *,
        mailboxes (
          email_address,
          display_name
        )
      `)
      .order('created_at', { ascending: false })

    if (mailboxId) {
      query = query.eq('mailbox_id', mailboxId)
    }

    const { data: subscriptions, error } = await query

    if (error) {
      throw error
    }

    console.log(`✅ Retrieved ${subscriptions?.length || 0} subscriptions`)

    return {
      success: true,
      subscriptions: subscriptions || []
    }

  } catch (error) {
    console.error('❌ Error listing subscriptions:', error)

    return {
      success: false,
      error: 'Failed to list subscriptions'
    }
  }
}

/**
 * Vérifie la santé des abonnements
 */
export async function getSubscriptionHealth(supabase: EdgeSupabaseClient): Promise<{
  success: boolean
  health?: SubscriptionHealth
  error?: string
}> {
  try {
    console.log('🏥 Checking subscription health...')

    const { data: subscriptions, error } = await supabase
      .from('webhook_subscriptions')
      .select('expiration_date_time, is_active, created_at')

    if (error) {
      throw error
    }

    const now = new Date()
    const renewThreshold = new Date(now.getTime() + SUBSCRIPTION_CONFIG.renewBeforeHours * 60 * 60 * 1000)

    let active = 0
    let expiringSoon = 0
    let expired = 0

    for (const sub of subscriptions || []) {
      const expiresAt = new Date((sub as any).expiration_date_time)

      if (!(sub as any).is_active || expiresAt <= now) {
        expired++
      } else if (expiresAt <= renewThreshold) {
        expiringSoon++
        active++
      } else {
        active++
      }
    }

    const health: SubscriptionHealth = {
      total: subscriptions?.length || 0,
      active,
      expiringSoon,
      expired,
      renewThresholdHours: SUBSCRIPTION_CONFIG.renewBeforeHours
    }

    console.log(`✅ Health check complete: ${active} active, ${expiringSoon} expiring soon, ${expired} expired`)

    return {
      success: true,
      health
    }

  } catch (error) {
    console.error('❌ Error getting subscription health:', error)

    return {
      success: false,
      error: 'Failed to get subscription health'
    }
  }
}

/**
 * Nettoie les abonnements expirés
 */
export async function cleanupExpiredSubscriptions(supabase: EdgeSupabaseClient): Promise<{
  success: boolean
  message?: string
  cleaned?: number
  error?: string
}> {
  try {
    console.log('🧹 Cleaning up expired subscriptions...')

    const now = new Date()

    // Récupérer les abonnements expirés
    const { data: expiredSubscriptions, error: fetchError } = await supabase
      .from('webhook_subscriptions')
      .select('subscription_id')
      .eq('is_active', true)
      .lt('expiration_date_time', now.toISOString())

    if (fetchError) {
      throw fetchError
    }

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      console.log('✅ No expired subscriptions found')
      return {
        success: true,
        message: 'No expired subscriptions found',
        cleaned: 0
      }
    }

    // Marquer comme inactifs (Microsoft Graph les supprime automatiquement)
    const { error: updateError } = await (supabase as any)
      .from('webhook_subscriptions')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('expiration_date_time', now.toISOString())

    if (updateError) {
      throw updateError
    }

    console.log(`✅ Cleaned up ${expiredSubscriptions.length} expired subscriptions`)

    return {
      success: true,
      message: `Cleaned up ${expiredSubscriptions.length} expired subscriptions`,
      cleaned: expiredSubscriptions.length
    }

  } catch (error) {
    console.error('❌ Error cleaning up expired subscriptions:', error)

    return {
      success: false,
      error: 'Failed to cleanup expired subscriptions'
    }
  }
}