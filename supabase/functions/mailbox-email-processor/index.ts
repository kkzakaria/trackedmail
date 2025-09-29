/**
 * Edge Function - Mailbox Email Processor
 *
 * Architecture modulaire pour le traitement des emails des mailboxes actives
 * - Récupération d'emails via Microsoft Graph
 * - Détection améliorée des réponses
 * - Classification et analyse des emails
 * - Traitement en lot avec statistiques détaillées
 *
 * Paramètres:
 * - startDate: Date de début (ISO string)
 * - endDate: Date de fin (ISO string)
 * - mailboxIds?: Array d'IDs de mailboxes spécifiques (optionnel)
 * - processResponses: boolean pour traiter également les réponses (défaut: true)
 */

import { createClient } from '@supabase/supabase-js'
import {
  EdgeSupabaseClient,
  ProcessorRequest
} from './shared-types.ts'
import { processMailboxEmails } from './email-processor.ts'

console.log('🚀 Mailbox Email Processor - Ready!')


/**
 * Handler principal de l'Edge Function
 */
Deno.serve(async (req) => {
  // Configuration Supabase
  const supabase: EdgeSupabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    console.warn(`[REQUEST] Method not allowed: ${req.method}`)
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
        message: 'Use POST with startDate and endDate parameters'
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  console.log('[REQUEST] POST email processing request received')

  try {
    // Parser les paramètres de la requête
    const body: ProcessorRequest = await req.json()
    console.log(`[PARAMS] Processing request: ${JSON.stringify(body, null, 2)}`)

    // Validation des paramètres requis
    if (!body.startDate || !body.endDate) {
      console.warn('[VALIDATION] Missing required parameters')
      return new Response(
        JSON.stringify({
          error: 'Missing required parameters',
          message: 'startDate and endDate are required (ISO string format)'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validation des dates
    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn('[VALIDATION] Invalid date format')
      return new Response(
        JSON.stringify({
          error: 'Invalid date format',
          message: 'Dates must be valid ISO strings'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (startDate >= endDate) {
      console.warn('[VALIDATION] Invalid date range')
      return new Response(
        JSON.stringify({
          error: 'Invalid date range',
          message: 'startDate must be before endDate'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validation de l'exigence de mailboxes spécifiques
    if (body.requireSpecificMailboxes && (!body.mailboxIds || body.mailboxIds.length === 0)) {
      console.warn('[VALIDATION] Specific mailboxes required but not provided')
      return new Response(
        JSON.stringify({
          error: 'Mailboxes required',
          message: 'When requireSpecificMailboxes is true, mailboxIds must be provided and cannot be empty'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Logging des paramètres
    console.log(`📅 Processing emails from ${body.startDate} to ${body.endDate}`)
    if (body.mailboxIds?.length) {
      console.log(`📫 Specific mailboxes (${body.mailboxIds.length}): ${body.mailboxIds.join(', ')}`)
    } else {
      console.log(`📬 Mode: Processing ALL active mailboxes`)
    }
    if (body.requireSpecificMailboxes) {
      console.log('⚠️ Specific mailboxes mode REQUIRED - will not process all mailboxes')
    }
    if (body.dryRun) {
      console.log('🎨 DRY RUN MODE - No data will be inserted')
    }

    // Traiter les emails
    const stats = await processMailboxEmails(supabase, body)

    console.log(`🎉 Processing completed successfully: ${stats.trackedEmailsInserted} emails tracked`)

    // Retourner les résultats
    return new Response(
      JSON.stringify({
        success: true,
        stats,
        parameters: {
          startDate: body.startDate,
          endDate: body.endDate,
          mailboxIds: body.mailboxIds,
          processResponses: body.processResponses ?? true,
          dryRun: body.dryRun ?? false,
          requireSpecificMailboxes: body.requireSpecificMailboxes ?? false
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error processing mailbox emails:', error)

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

