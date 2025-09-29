/**
 * Module de traitement amélioré des emails avec intégration
 * de la logique de détection de conversation
 */

import {
  EdgeSupabaseClient
} from '../_shared/types.ts'
import {
  MailboxRow
} from './shared-types.ts'
import {
  analyzeConversationContext,
  shouldCreateNewTrackedEmail,
  enhancedResponseDetection,
  logConversationDecision
} from '../microsoft-webhook/conversation-tracker.ts'
import {
  classifyEmailType,
  shouldExcludeEmail
} from '../microsoft-webhook/email-classifier.ts'
import {
  handleEmailResponse
} from '../microsoft-webhook/response-detector.ts'
import {
  logDetectionAttempt
} from '../microsoft-webhook/database-manager.ts'
import {
  getElapsedTime
} from '../microsoft-webhook/utils.ts'

/**
 * Interface pour l'email Graph adapté aux types du webhook
 */
export interface GraphEmail {
  id: string
  conversationId: string
  conversationIndex?: string
  internetMessageId: string
  subject: string
  sender: {
    emailAddress: {
      name: string
      address: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  ccRecipients?: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  sentDateTime: string
  hasAttachments: boolean
  importance: 'low' | 'normal' | 'high'
  bodyPreview: string
  inReplyTo?: string
  references?: string
  internetMessageHeaders?: Array<{
    name: string
    value: string
  }>
  parentFolderId?: string
  isDraft: boolean
  isRead: boolean
}

/**
 * Interface pour les résultats de traitement
 */
export interface EmailProcessingResult {
  emailsFound: number
  trackedInserted: number
  responsesFound: number
  skippedEmails: number
  errors: string[]
}

/**
 * Convertit un GraphEmail en EmailMessage pour compatibilité avec le webhook
 */
function convertToEmailMessage(graphEmail: GraphEmail): {
  id: string
  conversationId: string
  conversationIndex?: string
  internetMessageId: string
  subject: string
  sender: {
    emailAddress: {
      name: string
      address: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  sentDateTime: string
  bodyPreview: string
  hasAttachments: boolean
  importance: 'low' | 'normal' | 'high'
  inReplyTo?: string
  references?: string
  internetMessageHeaders?: Array<{
    name: string
    value: string
  }>
} {
  return {
    id: graphEmail.id,
    conversationId: graphEmail.conversationId,
    conversationIndex: graphEmail.conversationIndex,
    internetMessageId: graphEmail.internetMessageId,
    subject: graphEmail.subject,
    sender: graphEmail.sender,
    toRecipients: graphEmail.toRecipients,
    sentDateTime: graphEmail.sentDateTime,
    bodyPreview: graphEmail.bodyPreview,
    hasAttachments: graphEmail.hasAttachments,
    importance: graphEmail.importance,
    inReplyTo: graphEmail.inReplyTo,
    references: graphEmail.references,
    internetMessageHeaders: graphEmail.internetMessageHeaders
  }
}

/**
 * Traite un email avec la logique améliorée de détection
 */
export async function processEmailWithEnhancedDetection(
  supabase: EdgeSupabaseClient,
  graphEmail: GraphEmail,
  mailbox: MailboxRow,
  _tenantConfig: unknown
): Promise<{
  processed: boolean
  action: 'tracked' | 'response_detected' | 'skipped' | 'error'
  reason: string
}> {
  const startTime = Date.now()

  try {
    // Vérifier si l'email doit être exclu
    const emailMessage = convertToEmailMessage(graphEmail)

    if (await shouldExcludeEmail(supabase, emailMessage)) {
      await logDetectionAttempt(
        supabase,
        emailMessage,
        false,
        null,
        'not_detected',
        'internal_email',
        getElapsedTime(startTime)
      )
      return {
        processed: false,
        action: 'skipped',
        reason: 'internal_email'
      }
    }

    // Classifier l'email
    const emailType = classifyEmailType(emailMessage, mailbox)

    if (emailType === 'unknown') {
      return {
        processed: false,
        action: 'skipped',
        reason: 'classification_failed'
      }
    }

    if (emailType === 'outgoing') {
      return await processOutgoingEmailEnhanced(
        supabase,
        emailMessage,
        graphEmail,
        mailbox,
        startTime
      )
    } else {
      return await processIncomingEmailEnhanced(
        supabase,
        emailMessage,
        startTime
      )
    }

  } catch (error) {
    console.error('Error processing email with enhanced detection:', error)
    return {
      processed: false,
      action: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error'
    }
  }
}

/**
 * Traite un email sortant avec détection de conversation
 */
async function processOutgoingEmailEnhanced(
  supabase: EdgeSupabaseClient,
  emailMessage: ReturnType<typeof convertToEmailMessage>,
  graphEmail: GraphEmail,
  mailbox: { id: string },
  startTime: number
): Promise<{
  processed: boolean
  action: 'tracked' | 'skipped'
  reason: string
}> {
  // Analyser le contexte de conversation
  const conversationContext = await analyzeConversationContext(supabase, emailMessage)

  // Vérifier si on doit créer un nouvel email tracké
  const trackingDecision = await shouldCreateNewTrackedEmail(
    supabase,
    emailMessage,
    conversationContext
  )

  // Logger la décision
  await logConversationDecision(
    supabase,
    emailMessage,
    conversationContext,
    trackingDecision.reason,
    {
      shouldCreate: trackingDecision.shouldCreate,
      existingEmailId: trackingDecision.existingEmailId,
      source: 'mailbox_processor'
    }
  )

  if (!trackingDecision.shouldCreate) {
    await logDetectionAttempt(
      supabase,
      emailMessage,
      false,
      trackingDecision.existingEmailId || null,
      'not_tracked',
      trackingDecision.reason,
      getElapsedTime(startTime)
    )

    return {
      processed: false,
      action: 'skipped',
      reason: trackingDecision.reason
    }
  }

  // Créer l'email tracké
  const trackedEmailId = await insertTrackedEmailFromGraph(
    supabase,
    graphEmail,
    mailbox.id
  )

  if (!trackedEmailId) {
    return {
      processed: false,
      action: 'skipped',
      reason: 'insert_failed'
    }
  }

  await logDetectionAttempt(
    supabase,
    emailMessage,
    true,
    trackedEmailId,
    'outgoing_tracked',
    null,
    getElapsedTime(startTime)
  )

  console.log(`✅ Enhanced: Tracked new outgoing email: ${graphEmail.subject}`)

  return {
    processed: true,
    action: 'tracked',
    reason: 'new_conversation_starter'
  }
}

/**
 * Traite un email entrant avec détection améliorée
 */
async function processIncomingEmailEnhanced(
  supabase: EdgeSupabaseClient,
  emailMessage: ReturnType<typeof convertToEmailMessage>,
  startTime: number
): Promise<{
  processed: boolean
  action: 'response_detected' | 'skipped'
  reason: string
}> {
  // Utiliser la détection améliorée des réponses
  const responseDetection = await enhancedResponseDetection(supabase, emailMessage)

  if (responseDetection.isResponse) {
    console.log(`✅ Enhanced: Detected reply with ${responseDetection.confidence}% confidence`)

    // Si on a trouvé l'email original directement
    if (responseDetection.originalEmailId) {
      const { error } = await supabase
        .from('email_responses')
        .insert({
          tracked_email_id: responseDetection.originalEmailId,
          microsoft_message_id: emailMessage.id,
          sender_email: emailMessage.sender.emailAddress.address,
          subject: emailMessage.subject,
          body_preview: emailMessage.bodyPreview,
          received_at: emailMessage.sentDateTime,
          response_type: 'direct_reply',
          is_auto_response: false
        })

      if (!error) {
        await logDetectionAttempt(
          supabase,
          emailMessage,
          true,
          responseDetection.originalEmailId,
          'response_detected',
          null,
          getElapsedTime(startTime)
        )

        return {
          processed: true,
          action: 'response_detected',
          reason: responseDetection.method
        }
      }
    }

    // Sinon utiliser la méthode standard
    const result = await handleEmailResponse(supabase, emailMessage, startTime)

    return {
      processed: result.detected,
      action: result.detected ? 'response_detected' : 'skipped',
      reason: result.rejectionReason || 'standard_detection'
    }
  }

  await logDetectionAttempt(
    supabase,
    emailMessage,
    false,
    null,
    'incoming_not_reply',
    `not_a_reply_confidence_${responseDetection.confidence}`,
    getElapsedTime(startTime)
  )

  return {
    processed: false,
    action: 'skipped',
    reason: 'not_a_reply'
  }
}

/**
 * Insère un email tracké à partir d'un GraphEmail
 */
async function insertTrackedEmailFromGraph(
  supabase: EdgeSupabaseClient,
  graphEmail: GraphEmail,
  mailboxId: string
): Promise<string | null> {
  try {
    const recipientEmails = graphEmail.toRecipients.map(r => r.emailAddress.address)
    const ccEmails = graphEmail.ccRecipients?.map(r => r.emailAddress.address) || []

    const trackedEmail = {
      microsoft_message_id: graphEmail.id,
      conversation_id: graphEmail.conversationId,
      conversation_index: graphEmail.conversationIndex,
      internet_message_id: graphEmail.internetMessageId,
      in_reply_to: graphEmail.inReplyTo,
      references: graphEmail.references,
      mailbox_id: mailboxId,
      subject: graphEmail.subject,
      sender_email: graphEmail.sender.emailAddress.address,
      recipient_emails: recipientEmails,
      cc_emails: ccEmails.length > 0 ? ccEmails : undefined,
      body_preview: graphEmail.bodyPreview,
      has_attachments: graphEmail.hasAttachments,
      importance: graphEmail.importance,
      status: 'pending',
      sent_at: graphEmail.sentDateTime,
      is_reply: isReplyEmail(graphEmail),
      thread_position: calculateThreadPosition(graphEmail.conversationIndex)
    }

    const { data, error } = await supabase
      .from('tracked_emails')
      .insert(trackedEmail)
      .select('id')
      .single()

    if (error) {
      console.error('Error inserting tracked email:', error)
      return null
    }

    return data?.id || null
  } catch (error) {
    console.error('Error in insertTrackedEmailFromGraph:', error)
    return null
  }
}

/**
 * Vérifie si un GraphEmail est une réponse
 */
function isReplyEmail(graphEmail: GraphEmail): boolean {
  // Vérifier les headers
  if (graphEmail.internetMessageHeaders?.length) {
    const replyHeaders = ['In-Reply-To', 'References']
    for (const header of graphEmail.internetMessageHeaders) {
      if (replyHeaders.includes(header.name) && header.value) {
        return true
      }
    }
  }

  // Vérifier le sujet
  const replyPrefixes = ['RE:', 'Re:', 're:', 'Réf:', 'REF:', 'RES:', 'Res:', 'res:']
  const subject = graphEmail.subject.trim()

  for (const prefix of replyPrefixes) {
    if (subject.startsWith(prefix)) {
      return true
    }
  }

  // Vérifier conversationIndex
  if (graphEmail.conversationIndex) {
    return graphEmail.conversationIndex.length > 44
  }

  return false
}

/**
 * Calcule la position dans le thread
 */
function calculateThreadPosition(conversationIndex?: string): number {
  if (!conversationIndex) {
    return 1
  }

  try {
    const baseLength = 44
    const replyLength = 10

    if (conversationIndex.length <= baseLength) {
      return 1
    }

    const additionalLength = conversationIndex.length - baseLength
    return Math.floor(additionalLength / replyLength) + 1
  } catch {
    return 1
  }
}