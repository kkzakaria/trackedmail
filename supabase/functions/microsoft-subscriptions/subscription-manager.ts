/**
 * Gestionnaire principal des abonnements Microsoft Graph
 * Responsable de la création, renouvellement et suppression des abonnements
 */

import {
  EdgeSupabaseClient,
  SubscriptionRequest,
  SubscriptionPayload,
  SUBSCRIPTION_CONFIG
} from './shared-types.ts'
import { createGraphSubscription, renewGraphSubscription, deleteGraphSubscription } from './graph-api.ts'

/**
 * Crée un nouvel abonnement webhook
 */
export async function createSubscription(
  supabase: EdgeSupabaseClient,
  request: SubscriptionRequest
): Promise<{
  success: boolean
  subscription?: {
    id: string
    resource: string
    expiresAt: string
    changeType: string
    mailboxId: string
  }
  error?: string
  message?: string
}> {
  try {
    if (!request.mailboxId || !request.userId) {
      throw new Error('mailboxId and userId are required')
    }

    console.log(`📝 Creating subscription for mailbox ${request.mailboxId}`)

    // Vérifier que la mailbox existe
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('id', request.mailboxId)
      .eq('is_active', true)
      .single()

    if (mailboxError || !mailbox) {
      throw new Error('Mailbox not found or inactive')
    }

    // Vérifier qu'il n'y a pas déjà un abonnement actif
    const { data: existingSubscriptions } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('mailbox_id', request.mailboxId)
      .eq('is_active', true)

    if (existingSubscriptions && existingSubscriptions.length > 0) {
      throw new Error('Mailbox already has an active subscription')
    }

    // Configurer l'abonnement
    const webhookUrl = `${Deno.env.get('MICROSOFT_WEBHOOK_BASE_URL')}/microsoft-webhook`
    const clientState = Deno.env.get('MICROSOFT_WEBHOOK_SECRET') || 'default-secret'
    const expirationHours = request.expirationHours || SUBSCRIPTION_CONFIG.defaultExpirationHours
    const expirationDateTime = new Date(Date.now() + expirationHours * 60 * 60 * 1000)
    const changeTypes = request.changeTypes || SUBSCRIPTION_CONFIG.changeTypes

    const subscriptionPayload: SubscriptionPayload = {
      changeType: changeTypes.join(','),
      notificationUrl: webhookUrl,
      resource: `/users/${request.userId}/messages`,
      expirationDateTime: expirationDateTime.toISOString(),
      clientState: clientState,
      includeResourceData: SUBSCRIPTION_CONFIG.includeResourceData
    }

    // Créer l'abonnement via Microsoft Graph
    const graphSubscription = await createGraphSubscription(subscriptionPayload)

    // Stocker l'abonnement en base
    const { error: storeError } = await (supabase as any)
      .from('webhook_subscriptions')
      .insert({
        subscription_id: graphSubscription.id,
        resource: graphSubscription.resource,
        change_type: graphSubscription.changeType,
        notification_url: graphSubscription.notificationUrl,
        expiration_date_time: graphSubscription.expirationDateTime,
        mailbox_id: request.mailboxId,
        include_resource_data: graphSubscription.includeResourceData,
        is_active: true,
        renewal_count: 0
      })
      .select()
      .single()

    if (storeError) {
      // Tentative de nettoyage si l'insertion échoue
      try {
        await deleteGraphSubscription(graphSubscription.id)
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup Graph subscription after store error:', cleanupError)
      }
      throw storeError
    }

    console.log(`✅ Subscription created successfully: ${graphSubscription.id}`)

    return {
      success: true,
      subscription: {
        id: graphSubscription.id,
        resource: graphSubscription.resource,
        expiresAt: graphSubscription.expirationDateTime,
        changeType: graphSubscription.changeType,
        mailboxId: request.mailboxId
      }
    }

  } catch (error) {
    console.error('❌ Error creating subscription:', error)

    return {
      success: false,
      error: 'Failed to create subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Renouvelle un abonnement existant
 */
export async function renewSubscription(
  supabase: EdgeSupabaseClient,
  request: SubscriptionRequest
): Promise<{
  success: boolean
  subscription?: {
    id: string
    expiresAt: string
    renewalCount: number
  }
  error?: string
  message?: string
}> {
  try {
    if (!request.subscriptionId) {
      throw new Error('subscriptionId is required')
    }

    console.log(`🔄 Renewing subscription ${request.subscriptionId}`)

    // Récupérer l'abonnement existant
    const { data: subscription, error: subError } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('subscription_id', request.subscriptionId)
      .eq('is_active', true)
      .single()

    if (subError || !subscription) {
      throw new Error('Subscription not found or inactive')
    }

    // Calculer la nouvelle date d'expiration
    const expirationHours = request.expirationHours || SUBSCRIPTION_CONFIG.defaultExpirationHours
    const newExpirationDateTime = new Date(Date.now() + expirationHours * 60 * 60 * 1000)

    // Renouveler via Microsoft Graph
    const updatedSubscription = await renewGraphSubscription(
      request.subscriptionId,
      newExpirationDateTime.toISOString()
    )

    // Mettre à jour en base
    const { error: updateError } = await (supabase as any)
      .from('webhook_subscriptions')
      .update({
        expiration_date_time: updatedSubscription.expirationDateTime,
        last_renewed_at: new Date().toISOString(),
        renewal_count: (subscription as any).renewal_count + 1
      })
      .eq('subscription_id', request.subscriptionId)

    if (updateError) {
      throw updateError
    }

    console.log(`✅ Subscription renewed successfully: ${updatedSubscription.id}`)

    return {
      success: true,
      subscription: {
        id: updatedSubscription.id,
        expiresAt: updatedSubscription.expirationDateTime,
        renewalCount: (subscription as any).renewal_count + 1
      }
    }

  } catch (error) {
    console.error('❌ Error renewing subscription:', error)

    return {
      success: false,
      error: 'Failed to renew subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Supprime un abonnement spécifique
 */
export async function deleteSubscription(
  supabase: EdgeSupabaseClient,
  subscriptionId: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    console.log(`🗑️ Deleting subscription ${subscriptionId}`)

    // Supprimer de Microsoft Graph
    try {
      await deleteGraphSubscription(subscriptionId)
    } catch (graphError) {
      console.warn('⚠️ Failed to delete from Microsoft Graph (may already be deleted):', graphError)
    }

    // Marquer comme inactif en base
    const { error: updateError } = await (supabase as any)
      .from('webhook_subscriptions')
      .update({ is_active: false })
      .eq('subscription_id', subscriptionId)

    if (updateError) {
      throw updateError
    }

    console.log(`✅ Subscription deleted successfully: ${subscriptionId}`)

    return {
      success: true,
      message: 'Subscription deleted successfully'
    }

  } catch (error) {
    console.error('❌ Error deleting subscription:', error)

    return {
      success: false,
      error: 'Failed to delete subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Supprime tous les abonnements d'une mailbox
 */
export async function deleteMailboxSubscriptions(
  supabase: EdgeSupabaseClient,
  mailboxId: string
): Promise<{
  success: boolean
  message?: string
  details?: { successful: number; failed: number; total: number }
  error?: string
}> {
  try {
    console.log(`🗑️ Deleting all subscriptions for mailbox ${mailboxId}`)

    // Récupérer tous les abonnements actifs de la mailbox
    const { data: subscriptions, error: fetchError } = await supabase
      .from('webhook_subscriptions')
      .select('subscription_id')
      .eq('mailbox_id', mailboxId)
      .eq('is_active', true)

    if (fetchError) {
      throw fetchError
    }

    if (!subscriptions || subscriptions.length === 0) {
      return {
        success: true,
        message: 'No active subscriptions found for this mailbox'
      }
    }

    // Supprimer chaque abonnement
    const deletionResults = await Promise.allSettled(
      subscriptions.map((sub: { subscription_id: string }) =>
        deleteGraphSubscription(sub.subscription_id)
      )
    )

    // Marquer tous comme inactifs
    const { error: updateError } = await (supabase as any)
      .from('webhook_subscriptions')
      .update({ is_active: false })
      .eq('mailbox_id', mailboxId)

    if (updateError) {
      throw updateError
    }

    const successful = deletionResults.filter(r => r.status === 'fulfilled').length
    const failed = deletionResults.filter(r => r.status === 'rejected').length

    console.log(`✅ Deleted ${successful}/${subscriptions.length} subscriptions for mailbox ${mailboxId}`)

    return {
      success: true,
      message: `Deleted ${successful} subscriptions, ${failed} failed`,
      details: { successful, failed, total: subscriptions.length }
    }

  } catch (error) {
    console.error('❌ Error deleting mailbox subscriptions:', error)

    return {
      success: false,
      error: 'Failed to delete mailbox subscriptions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}