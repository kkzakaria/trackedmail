/**
 * Edge Function - Microsoft Graph Subscription Management
 *
 * Architecture modulaire pour la gestion des abonnements webhook Microsoft Graph
 * - Création et renouvellement d'abonnements
 * - Surveillance et monitoring de la santé
 * - Nettoyage automatique des abonnements expirés
 * - Interface avec l'API Microsoft Graph
 */

import { createClient } from '@supabase/supabase-js'
import {
  EdgeSupabaseClient,
  SubscriptionRequest
} from './shared-types.ts'
import {
  createSubscription,
  renewSubscription,
  deleteSubscription,
  deleteMailboxSubscriptions
} from './subscription-manager.ts'
import {
  listSubscriptions,
  getSubscriptionHealth,
  cleanupExpiredSubscriptions
} from './subscription-monitor.ts'

console.log('🚀 Microsoft Graph Subscription Manager - Ready!')


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
    console.log('[CORS] Preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  console.log(`[REQUEST] ${req.method} subscription management request received`)

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
        console.warn(`[REQUEST] Method not allowed: ${req.method}`)
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

  } catch (error) {
    console.error('❌ Error in subscription management:', error)

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
 * Gère les requêtes POST (création, renouvellement, nettoyage)
 */
async function handlePostRequest(
  req: Request,
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const subscriptionRequest: SubscriptionRequest = await req.json()
    console.log(`[POST] Processing action: ${subscriptionRequest.action}`)

    let result
    switch (subscriptionRequest.action) {
      case 'create':
        result = await createSubscription(supabase, subscriptionRequest)
        break
      case 'renew':
        result = await renewSubscription(supabase, subscriptionRequest)
        break
      case 'cleanup':
        result = await cleanupExpiredSubscriptions(supabase)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action for POST request. Valid actions: create, renew, cleanup' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? (subscriptionRequest.action === 'create' ? 201 : 200) : 400,
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

/**
 * Gère les requêtes GET (liste des abonnements, santé)
 */
async function handleGetRequest(
  req: Request,
  supabase: EdgeSupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const mailboxId = url.searchParams.get('mailboxId')

  console.log(`[GET] Processing action: ${action}${mailboxId ? ` for mailbox ${mailboxId}` : ''}`)

  try {
    let result
    switch (action) {
      case 'list':
        result = await listSubscriptions(supabase, mailboxId)
        break
      case 'health':
        result = await getSubscriptionHealth(supabase)
        break
      default:
        // Par défaut, lister les abonnements
        result = await listSubscriptions(supabase, mailboxId)
        break
    }

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

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

  console.log(`[DELETE] Subscription: ${subscriptionId || 'N/A'}, Mailbox: ${mailboxId || 'N/A'}`)

  try {
    let result
    if (subscriptionId) {
      result = await deleteSubscription(supabase, subscriptionId)
    } else if (mailboxId) {
      result = await deleteMailboxSubscriptions(supabase, mailboxId)
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing subscriptionId or mailboxId parameter' }),
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
    console.error('❌ Error handling DELETE request:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process DELETE request',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

