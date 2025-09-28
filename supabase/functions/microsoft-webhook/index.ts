/**
 * Edge Function - Microsoft Graph Webhook Handler
 *
 * Architecture modulaire pour le traitement des notifications webhook Microsoft Graph
 * - Validation de sécurité
 * - Classification des emails
 * - Détection des réponses
 * - Gestion des relances
 * - Tracking automatique
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  EdgeSupabaseClient,
  WebhookPayload,
  ProcessingStats
} from './shared-types.ts'
import { validateWebhookSecurity, handleValidationChallenge } from './security-validator.ts'
import { processNotificationBatch } from './notification-processor.ts'
import { logWebhookEvent, updateProcessingStats } from './database-manager.ts'

console.log('🚀 Microsoft Graph Webhook Handler - Ready!')

/**
 * Handler principal de l'Edge Function
 */
Deno.serve(async (req) => {
  // Configuration Supabase
  const supabase: EdgeSupabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier s'il y a un validationToken dans l'URL (GET ou POST)
  const url = new URL(req.url)
  const validationToken = url.searchParams.get('validationToken')

  if (validationToken) {
    console.log(`[VALIDATION] ${req.method} validation request detected`)
    return handleValidationChallenge(validationToken)
  }

  // Gestion de la validation GET (fallback)
  if (req.method === 'GET') {
    console.log('[VALIDATION] GET request without validation token, returning OK')
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  // Vérification de la méthode HTTP pour les notifications
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  console.log(`[WEBHOOK] POST notification received`)

  try {
    // Lecture et validation du payload
    const payload = await parseWebhookPayload(req)
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or empty payload' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Gestion de la validation via POST (format alternatif)
    if (payload.validationTokens && payload.validationTokens.length > 0) {
      console.log('Webhook validation requested via POST')
      return handleValidationChallenge(payload.validationTokens[0])
    }

    // Vérification de la sécurité
    const securityContext = await validateWebhookSecurity(req, payload)
    if (!securityContext.isValid) {
      console.warn('Webhook security validation failed:', securityContext.failureReason)
      return new Response(
        JSON.stringify({
          error: 'Invalid webhook signature or client state',
          reason: securityContext.failureReason
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Log de réception webhook
    await logWebhookEvent(supabase, payload, req)

    // Traitement des notifications en batch
    const stats = await processNotificationBatch(supabase, payload.value)

    // Mise à jour des statistiques
    await updateProcessingStats(supabase, stats)

    console.log(`✅ Webhook processing complete: ${stats.processed} processed, ${stats.successful} successful, ${stats.failed} failed`)

    // Réponse de succès
    return new Response(
      JSON.stringify(stats),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error processing webhook:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Parse et valide le payload du webhook
 */
async function parseWebhookPayload(req: Request): Promise<WebhookPayload | null> {
  try {
    const contentType = req.headers.get('content-type')

    if (!contentType || !contentType.includes('application/json')) {
      console.error('Invalid content type:', contentType)
      return null
    }

    const text = await req.text()
    if (!text || text.trim() === '') {
      console.log('Received empty body, treating as ping request')
      return null
    }

    return JSON.parse(text) as WebhookPayload
  } catch (error) {
    console.error('Failed to parse webhook payload:', error)
    return null
  }
}