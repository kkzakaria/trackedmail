/**
 * Edge Function - Microsoft Graph Subscription Management
 *
 * Gère les abonnements webhook Microsoft Graph
 * Création, renouvellement automatique, suppression et monitoring des abonnements
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  EdgeSupabaseClient
} from '../_shared/types.ts'

console.log('Microsoft Graph Subscription Manager - Ready!')

/**
 * Interface pour les requêtes d'abonnement
 */
interface SubscriptionRequest {
  action: 'create' | 'renew' | 'delete' | 'list' | 'cleanup'
  mailboxId?: string
  subscriptionId?: string
  userId?: string
  changeTypes?: string[]
  expirationHours?: number
}

/**
 * Interface pour le payload de création d'abonnement
 */
interface SubscriptionPayload {
  changeType: string
  notificationUrl: string
  resource: string
  expirationDateTime: string
  clientState: string
  includeResourceData: boolean
}

/**
 * Interface pour les abonnements Microsoft Graph
 */
interface GraphSubscription {
  id: string
  resource: string
  applicationId: string
  changeType: string
  clientState: string
  notificationUrl: string
  lifecycleNotificationUrl?: string
  expirationDateTime: string
  creatorId: string
  includeResourceData: boolean
  latestSupportedTlsVersion: string
}

/**
 * Configuration par défaut pour les abonnements
 */
const SUBSCRIPTION_CONFIG = {
  defaultExpirationHours: 72, // Maximum pour Microsoft Graph
  renewBeforeHours: 1,
  maxSubscriptionsPerMailbox: 1,
  changeTypes: ['created'], // On ne s'intéresse qu'aux nouveaux emails
  includeResourceData: false
}

/**
 * Handler principal de l'Edge Function
 */
Deno.serve(async (req) => {
  // Configuration Supabase
  const supabase: EdgeSupabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE'
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Route selon la méthode HTTP
    switch (req.method) {
      case 'POST':
        return await handlePostRequest(req, supabase, corsHeaders)
      case 'GET':
        return await handleGetRequest(req, supabase, corsHeaders)
      case 'DELETE':
        return await handleDeleteRequest(req, supabase, corsHeaders)
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

  } catch (error) {
    console.error('Error in subscription management:', error)

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
 * Gère les requêtes POST (création, renouvellement)
 */
async function handlePostRequest(
  req: Request,
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const subscriptionRequest: SubscriptionRequest = await req.json()

  switch (subscriptionRequest.action) {
    case 'create':
      return await createSubscription(supabase, subscriptionRequest, corsHeaders)
    case 'renew':
      return await renewSubscription(supabase, subscriptionRequest, corsHeaders)
    case 'cleanup':
      return await cleanupExpiredSubscriptions(supabase, corsHeaders)
    default:
      return new Response(
        JSON.stringify({ error: 'Invalid action for POST request' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
  }
}

/**
 * Gère les requêtes GET (liste des abonnements)
 */
async function handleGetRequest(
  req: Request,
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const mailboxId = url.searchParams.get('mailboxId')

  switch (action) {
    case 'list':
      return await listSubscriptions(supabase, mailboxId, corsHeaders)
    case 'health':
      return await getSubscriptionHealth(supabase, corsHeaders)
    default:
      return await listSubscriptions(supabase, mailboxId, corsHeaders)
  }
}

/**
 * Gère les requêtes DELETE (suppression d'abonnements)
 */
async function handleDeleteRequest(
  req: Request,
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(req.url)
  const subscriptionId = url.searchParams.get('subscriptionId')
  const mailboxId = url.searchParams.get('mailboxId')

  if (subscriptionId) {
    return await deleteSubscription(supabase, subscriptionId, corsHeaders)
  } else if (mailboxId) {
    return await deleteMailboxSubscriptions(supabase, mailboxId, corsHeaders)
  } else {
    return new Response(
      JSON.stringify({ error: 'Missing subscriptionId or mailboxId parameter' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * Crée un nouvel abonnement webhook
 */
async function createSubscription(
  supabase: EdgeSupabaseClient,
  request: SubscriptionRequest,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!request.mailboxId || !request.userId) {
      throw new Error('mailboxId and userId are required')
    }

    console.log(`Creating subscription for mailbox ${request.mailboxId}`)

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

    const subscriptionPayload = {
      changeType: changeTypes.join(','),
      notificationUrl: webhookUrl,
      resource: `/users/${request.userId}/mailFolders/sentitems/messages`,
      expirationDateTime: expirationDateTime.toISOString(),
      clientState: clientState,
      includeResourceData: SUBSCRIPTION_CONFIG.includeResourceData
    }

    // Créer l'abonnement via Microsoft Graph
    const graphSubscription = await createGraphSubscription(subscriptionPayload)

    // Stocker l'abonnement en base
    const { error: storeError } = await supabase
      .from('webhook_subscriptions')
      .insert({
        subscription_id: graphSubscription.id,
        resource: graphSubscription.resource,
        change_type: graphSubscription.changeType,
        notification_url: graphSubscription.notificationUrl,
        expiration_date_time: graphSubscription.expirationDateTime,
        client_state: graphSubscription.clientState,
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
        deleteGraphSubscription(graphSubscription.id)
      } catch (cleanupError) {
        console.warn('Failed to cleanup Graph subscription after store error:', cleanupError)
      }
      throw storeError
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: graphSubscription.id,
          resource: graphSubscription.resource,
          expiresAt: graphSubscription.expirationDateTime,
          changeType: graphSubscription.changeType,
          mailboxId: request.mailboxId
        }
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error creating subscription:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to create subscription',
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
 * Renouvelle un abonnement existant
 */
async function renewSubscription(
  supabase: EdgeSupabaseClient,
  request: SubscriptionRequest,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!request.subscriptionId) {
      throw new Error('subscriptionId is required')
    }

    console.log(`Renewing subscription ${request.subscriptionId}`)

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
    const updatedSubscription = renewGraphSubscription(
      request.subscriptionId,
      newExpirationDateTime.toISOString()
    )

    // Mettre à jour en base
    const { error: updateError } = await supabase
      .from('webhook_subscriptions')
      .update({
        expiration_date_time: updatedSubscription.expirationDateTime,
        last_renewed_at: new Date().toISOString(),
        renewal_count: subscription.renewal_count + 1
      })
      .eq('subscription_id', request.subscriptionId)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: updatedSubscription.id,
          expiresAt: updatedSubscription.expirationDateTime,
          renewalCount: subscription.renewal_count + 1
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error renewing subscription:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to renew subscription',
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
 * Supprime un abonnement spécifique
 */
async function deleteSubscription(
  supabase: EdgeSupabaseClient,
  subscriptionId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    console.log(`Deleting subscription ${subscriptionId}`)

    // Supprimer de Microsoft Graph
    try {
      deleteGraphSubscription(subscriptionId)
    } catch (graphError) {
      console.warn('Failed to delete from Microsoft Graph (may already be deleted):', graphError)
    }

    // Marquer comme inactif en base
    const { error: updateError } = await supabase
      .from('webhook_subscriptions')
      .update({ is_active: false })
      .eq('subscription_id', subscriptionId)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription deleted successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error deleting subscription:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to delete subscription',
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
 * Supprime tous les abonnements d'une mailbox
 */
async function deleteMailboxSubscriptions(
  supabase: EdgeSupabaseClient,
  mailboxId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    console.log(`Deleting all subscriptions for mailbox ${mailboxId}`)

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
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active subscriptions found for this mailbox'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Supprimer chaque abonnement
    const deletionResults = subscriptions.map((sub: { subscription_id: string }) => {
      try {
        deleteGraphSubscription(sub.subscription_id)
        return { status: 'fulfilled' as const }
      } catch (error) {
        return { status: 'rejected' as const, reason: error }
      }
    })

    // Marquer tous comme inactifs
    const { error: updateError } = await supabase
      .from('webhook_subscriptions')
      .update({ is_active: false })
      .eq('mailbox_id', mailboxId)

    if (updateError) {
      throw updateError
    }

    const successful = deletionResults.filter((r: { status: 'fulfilled' | 'rejected' }) => r.status === 'fulfilled').length
    const failed = deletionResults.filter((r: { status: 'fulfilled' | 'rejected' }) => r.status === 'rejected').length

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${successful} subscriptions, ${failed} failed`,
        details: { successful, failed, total: subscriptions.length }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error deleting mailbox subscriptions:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to delete mailbox subscriptions',
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
 * Liste les abonnements
 */
async function listSubscriptions(
  supabase: EdgeSupabaseClient,
  mailboxId: string | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
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

    return new Response(
      JSON.stringify({
        success: true,
        subscriptions: subscriptions || []
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error listing subscriptions:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to list subscriptions',
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
 * Vérifie la santé des abonnements
 */
async function getSubscriptionHealth(
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
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
      const expiresAt = new Date(sub.expiration_date_time)

      if (!sub.is_active || expiresAt <= now) {
        expired++
      } else if (expiresAt <= renewThreshold) {
        expiringSoon++
        active++
      } else {
        active++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        health: {
          total: subscriptions?.length || 0,
          active,
          expiringSoon,
          expired,
          renewThresholdHours: SUBSCRIPTION_CONFIG.renewBeforeHours
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error getting subscription health:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get subscription health',
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
 * Nettoie les abonnements expirés
 */
async function cleanupExpiredSubscriptions(
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    console.log('Cleaning up expired subscriptions...')

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
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired subscriptions found',
          cleaned: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Marquer comme inactifs (Microsoft Graph les supprime automatiquement)
    const { error: updateError } = await supabase
      .from('webhook_subscriptions')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('expiration_date_time', now.toISOString())

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${expiredSubscriptions.length} expired subscriptions`,
        cleaned: expiredSubscriptions.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error cleaning up expired subscriptions:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to cleanup expired subscriptions',
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
 * Crée un abonnement via Microsoft Graph API
 */
async function createGraphSubscription(subscriptionPayload: SubscriptionPayload): Promise<GraphSubscription> {
  console.log('Creating Graph subscription with payload:', subscriptionPayload)

  try {
    // Obtenir un token d'accès via l'Edge Function microsoft-auth
    const tokenResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        action: 'acquire',
        scopes: ['https://graph.microsoft.com/.default']
      })
    })

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get access token: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    if (!tokenData.success || !tokenData.access_token) {
      throw new Error('Invalid token response')
    }

    // Créer la souscription via Microsoft Graph API
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionPayload)
    })

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text()
      throw new Error(`Microsoft Graph API error: ${graphResponse.status} ${errorText}`)
    }

    const subscription = await graphResponse.json()
    console.log('Successfully created Graph subscription:', subscription.id)

    return subscription as GraphSubscription
  } catch (error) {
    console.error('Error creating Graph subscription:', error)
    throw error
  }
}

/**
 * Renouvelle un abonnement via Microsoft Graph API
 */
function renewGraphSubscription(subscriptionId: string, expirationDateTime: string): GraphSubscription {
  // TODO: Implémenter l'appel réel à Microsoft Graph
  console.log(`Would renew subscription ${subscriptionId} with expiration ${expirationDateTime}`)

  // Simulation d'une réponse Microsoft Graph
  return {
    id: subscriptionId,
    resource: '/users/user-id/messages',
    applicationId: 'app-id',
    changeType: 'created',
    clientState: 'client-state',
    notificationUrl: 'webhook-url',
    expirationDateTime,
    creatorId: 'creator-id',
    includeResourceData: false,
    latestSupportedTlsVersion: 'v1_2'
  }
}

/**
 * Supprime un abonnement via Microsoft Graph API
 */
function deleteGraphSubscription(subscriptionId: string): void {
  // TODO: Implémenter l'appel réel à Microsoft Graph
  console.log(`Would delete Graph subscription ${subscriptionId}`)
}