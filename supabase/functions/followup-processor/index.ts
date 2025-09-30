/**
 * Edge Function - Followup Processor
 *
 * Traite les créneaux horaires fixes (7h, 12h, 16h) pour l'envoi de relances.
 * Architecture modulaire pour la gestion des emails éligibles et l'envoi automatique.
 *
 * Responsabilités:
 * - Vérification de l'activation du système
 * - Récupération des emails éligibles pour chaque créneau
 * - Envoi des relances via Microsoft Graph
 * - Gestion des templates et du threading
 * - Traitement des emails nécessitant une prise en charge manuelle
 *
 * Paramètres:
 * - time_slot: '07:00' | '12:00' | '16:00' (requis)
 * - source: string (optionnel) - Source de déclenchement
 * - timestamp: string (optionnel) - Timestamp ISO de la requête
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import type {
  EdgeSupabaseClient,
  TimeSlotProcessor,
  ProcessingStats
} from './shared-types.ts'
import { checkFollowupSystemEnabled, getFollowupConfig, getActiveTemplates } from './config-manager.ts'
import { getEmailsEligibleForTimeSlot } from './eligibility-checker.ts'
import { renderTemplate } from './template-renderer.ts'
import { sendFollowup, markEmailForManualHandling } from './email-sender.ts'
import { getMicrosoftGraphToken } from './utils.ts'

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// 🚨 SAFETY CHECK: Protection contre l'envoi d'emails en développement
const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production'
const allowRealEmails = Deno.env.get('ALLOW_REAL_EMAILS') === 'true'

if (isDevelopment && !allowRealEmails) {
  console.log('🛡️ DEVELOPMENT SAFETY MODE: Real email sending is DISABLED')
  console.log('💡 Set ALLOW_REAL_EMAILS=true to override (BE CAREFUL!)')
}

console.log('🕐 Followup Processor Function Started')

/**
 * Handler principal de l'Edge Function
 */
Deno.serve(async (req) => {
  try {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const requestBody = await req.json() as TimeSlotProcessor
    const { time_slot, source = 'unknown' } = requestBody

    console.log(`🕐 Processing followups for time slot: ${time_slot} (source: ${source})`)

    // Créer le client Supabase avec les droits de service
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Vérifier si le système de relances est activé
    const isFollowupEnabled = await checkFollowupSystemEnabled(supabase)
    if (!isFollowupEnabled) {
      console.log('⚠️ Followup system is disabled. Skipping processing.')
      return new Response(JSON.stringify({
        success: true,
        message: 'Followup system is disabled',
        time_slot,
        emails_analyzed: 0,
        followups_sent: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Traiter le créneau horaire
    const result = await processTimeSlot(supabase, time_slot)

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400
    })

  } catch (error) {
    console.error('❌ Followup Processor Error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

/**
 * Traite un créneau horaire spécifique (7h, 12h, ou 16h)
 * @param supabase Client Supabase avec droits service
 * @param timeSlot Créneau à traiter
 * @returns Statistiques de traitement
 */
async function processTimeSlot(
  supabase: EdgeSupabaseClient,
  timeSlot: string
): Promise<ProcessingStats> {
  const startTime = Date.now()

  console.log(`🕐 Starting time slot processing: ${timeSlot}`)

  // 1. Récupérer la configuration système
  const config = await getFollowupConfig(supabase)

  // 2. Récupérer les emails éligibles pour ce créneau
  const emailsEligible = await getEmailsEligibleForTimeSlot(supabase, timeSlot, config)

  console.log(`📧 Found ${emailsEligible.length} emails eligible for time slot ${timeSlot}`)

  if (emailsEligible.length === 0) {
    return {
      success: true,
      message: `No emails eligible for time slot ${timeSlot}`,
      time_slot: timeSlot,
      emails_analyzed: 0,
      emails_eligible: 0,
      followups_sent: 0,
      followups_failed: 0
    }
  }

  // 3. Récupérer les templates actifs
  const templates = await getActiveTemplates(supabase)

  // 4. Obtenir token Microsoft Graph
  const accessToken = await getMicrosoftGraphToken()

  // 5. Traiter chaque email éligible
  let followupsSent = 0
  let followupsFailed = 0
  const errors: string[] = []

  for (const email of emailsEligible) {
    try {
      // Trouver le template approprié
      const template = templates.find(t => t.followup_number === email.next_followup_number)
      if (!template) {
        console.log(`📝 No template found for followup ${email.next_followup_number}`)
        continue
      }

      // Envoyer la relance
      const renderedTemplate = renderTemplate(template, email)
      await sendFollowup(supabase, email, template, renderedTemplate, accessToken)
      followupsSent++

      console.log(`✅ Sent followup ${email.next_followup_number} for email ${email.id} at slot ${timeSlot}`)

      // Vérifier si on a atteint 4 relances sans réponse
      if (email.next_followup_number === 4) {
        await markEmailForManualHandling(supabase, email.id)
      }

    } catch (error) {
      const errorMsg = `Failed to process email ${email.id}: ${error instanceof Error ? error.message : String(error)}`
      console.error(`❌ ${errorMsg}`)
      errors.push(errorMsg)
      followupsFailed++
    }
  }

  const processingTime = Date.now() - startTime

  console.log(`🎯 Time slot ${timeSlot} completed in ${processingTime}ms:`)
  console.log(`   📧 Emails analyzed: ${emailsEligible.length}`)
  console.log(`   ✅ Followups sent: ${followupsSent}`)
  console.log(`   ❌ Failed: ${followupsFailed}`)

  return {
    success: true,
    message: `Time slot ${timeSlot} processing completed`,
    time_slot: timeSlot,
    emails_analyzed: emailsEligible.length,
    emails_eligible: emailsEligible.length,
    followups_sent: followupsSent,
    followups_failed: followupsFailed,
    errors: errors.length > 0 ? errors : undefined
  }
}