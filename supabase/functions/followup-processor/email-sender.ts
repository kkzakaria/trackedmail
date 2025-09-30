/**
 * Envoi des emails de relance via Microsoft Graph API
 * Gestion du threading, des headers personnalisés et de l'enregistrement en base
 */

import type {
  EdgeSupabaseClient,
  EmailEligibleForSlot,
  FollowupTemplate,
  RenderedTemplate
} from './shared-types.ts'
import { convertTextToHtml } from './utils.ts'

// 🚨 SAFETY CHECK: Protection contre l'envoi d'emails en développement
const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production'
const allowRealEmails = Deno.env.get('ALLOW_REAL_EMAILS') === 'true'

/**
 * Envoie une relance immédiatement via Microsoft Graph API
 * Gère le threading avec l'email original et ajoute des headers personnalisés
 * @param supabase Client Supabase
 * @param email Email éligible pour relance
 * @param template Template utilisé
 * @param renderedTemplate Template rendu avec variables
 * @param accessToken Token Microsoft Graph
 * @throws Error si l'envoi échoue
 */
export async function sendFollowup(
  supabase: EdgeSupabaseClient,
  email: EmailEligibleForSlot,
  template: FollowupTemplate,
  renderedTemplate: RenderedTemplate,
  accessToken: string
): Promise<void> {
  // Récupérer les informations de threading de l'email original
  const { data: originalEmail, error: emailError } = await supabase
    .from('tracked_emails')
    .select('internet_message_id, conversation_id, microsoft_message_id')
    .eq('id', email.id)
    .single()

  if (emailError || !originalEmail) {
    throw new Error(`Failed to fetch original email details: ${emailError?.message || 'Not found'}`)
  }

  console.log(`📨 Sending followup ${template.followup_number} for email ${email.id}`)

  // 🚨 SAFETY CHECK: Bloquer l'envoi en développement
  if (isDevelopment && !allowRealEmails) {
    console.log('🛡️ BLOCKED: Real email sending disabled in development')
    console.log(`📧 Would send to: ${email.recipient_emails.join(', ')}`)
    console.log(`📝 Subject: ${renderedTemplate.subject}`)

    // Simuler l'envoi en sauvegardant comme "sent" mais sans vraiment envoyer
    await recordFollowupSent(supabase, email.id, template, renderedTemplate)
    console.log('✅ Simulated email send (DEVELOPMENT MODE)')
    return
  }

  // Construire le message avec threading
  const messageData = {
    subject: renderedTemplate.subject,
    body: {
      contentType: 'HTML',
      content: convertTextToHtml(renderedTemplate.body)
    },
    toRecipients: email.recipient_emails.map(emailAddr => ({
      emailAddress: { address: emailAddr }
    })),
    from: {
      emailAddress: { address: email.mailbox.email_address }
    },
    internetMessageHeaders: [
      {
        name: 'X-TrackedMail-Followup',
        value: 'true'
      },
      {
        name: 'X-TrackedMail-System',
        value: 'fixed-schedule-processor'
      },
      {
        name: 'X-TrackedMail-Data',
        value: `${template.followup_number}:${email.id}:${new Date().toISOString()}`
      }
    ],
    conversationId: originalEmail.conversation_id
  }

  // Choisir l'API appropriée
  let graphUrl: string
  let requestBody: { message: typeof messageData }

  if (originalEmail.microsoft_message_id) {
    // Utiliser Reply API pour threading natif
    graphUrl = `https://graph.microsoft.com/v1.0/users/${email.mailbox.microsoft_user_id}/messages/${originalEmail.microsoft_message_id}/reply`
    requestBody = { message: messageData }
  } else {
    // Utiliser SendMail avec headers custom
    graphUrl = `https://graph.microsoft.com/v1.0/users/${email.mailbox.microsoft_user_id}/sendMail`
    requestBody = { message: messageData }
  }

  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to send followup via Microsoft Graph: ${response.status} ${errorText}`)
  }

  // Enregistrer la relance en base
  await recordFollowupSent(supabase, email.id, template, renderedTemplate)
}

/**
 * Enregistre une relance envoyée en base de données
 * @param supabase Client Supabase
 * @param emailId ID de l'email tracké
 * @param template Template utilisé
 * @param renderedTemplate Template rendu
 */
export async function recordFollowupSent(
  supabase: EdgeSupabaseClient,
  emailId: string,
  template: FollowupTemplate,
  renderedTemplate: RenderedTemplate
): Promise<void> {
  const { error } = await supabase
    .from('followups')
    .insert({
      tracked_email_id: emailId,
      template_id: template.id,
      followup_number: template.followup_number,
      subject: renderedTemplate.subject,
      body: renderedTemplate.body,
      scheduled_for: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      status: 'sent'
    })

  if (error) {
    console.error(`Failed to record followup sent:`, error)
    // Ne pas faire échouer l'envoi pour un problème d'enregistrement
  }
}

/**
 * Marque un email pour prise en charge manuelle (4 relances sans réponse)
 * @param supabase Client Supabase
 * @param emailId ID de l'email tracké
 */
export async function markEmailForManualHandling(
  supabase: EdgeSupabaseClient,
  emailId: string
): Promise<void> {
  const { error } = await supabase
    .from('tracked_emails')
    .update({
      status: 'requires_manual_handling',
      updated_at: new Date().toISOString()
    })
    .eq('id', emailId)

  if (error) {
    console.error(`Failed to mark email for manual handling:`, error)
  } else {
    console.log(`📋 Email ${emailId} marked for manual handling (4 followups completed)`)
  }
}