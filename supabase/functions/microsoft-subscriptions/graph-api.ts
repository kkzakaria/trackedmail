/**
 * Interface avec l'API Microsoft Graph pour les abonnements
 * Responsable des appels directs à l'API Graph
 */

import {
  SubscriptionPayload,
  GraphSubscription
} from './shared-types.ts'

/**
 * Crée un abonnement via Microsoft Graph API
 */
export async function createGraphSubscription(subscriptionPayload: SubscriptionPayload): Promise<GraphSubscription> {
  console.log('🔗 Creating Graph subscription with payload:', subscriptionPayload)

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
    console.log('✅ Successfully created Graph subscription:', subscription.id)

    return subscription as GraphSubscription
  } catch (error) {
    console.error('❌ Error creating Graph subscription:', error)
    throw error
  }
}

/**
 * Renouvelle un abonnement via Microsoft Graph API
 */
export async function renewGraphSubscription(subscriptionId: string, expirationDateTime: string): Promise<GraphSubscription> {
  console.log(`🔄 Renewing Graph subscription ${subscriptionId} with expiration ${expirationDateTime}`)

  try {
    // Obtenir un token d'accès
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

    // Renouveler via Microsoft Graph API
    const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expirationDateTime
      })
    })

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text()
      throw new Error(`Microsoft Graph API error: ${graphResponse.status} ${errorText}`)
    }

    const subscription = await graphResponse.json()
    console.log('✅ Successfully renewed Graph subscription:', subscription.id)

    return subscription as GraphSubscription
  } catch (error) {
    console.error('❌ Error renewing Graph subscription:', error)
    throw error
  }
}

/**
 * Supprime un abonnement via Microsoft Graph API
 */
export async function deleteGraphSubscription(subscriptionId: string): Promise<void> {
  console.log(`🗑️ Deleting Graph subscription ${subscriptionId}`)

  try {
    // Obtenir un token d'accès
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

    // Supprimer via Microsoft Graph API
    const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    })

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text()
      throw new Error(`Microsoft Graph API error: ${graphResponse.status} ${errorText}`)
    }

    console.log('✅ Successfully deleted Graph subscription:', subscriptionId)
  } catch (error) {
    console.error('❌ Error deleting Graph subscription:', error)
    throw error
  }
}