/**
 * Module de traitement des notifications webhook
 */

import {
  EdgeSupabaseClient,
  MicrosoftGraphWebhookNotification,
  NotificationContext,
  EmailMessage,
  DetectionResult,
  ProcessingStats,
  MailboxRow
} from './shared-types.ts'
import { extractResourceIdentifiers, getElapsedTime } from './utils.ts'
import { getMessageDetails } from './message-fetcher.ts'
import { classifyEmailType, shouldExcludeEmail } from './email-classifier.ts'
import { handleEmailResponse, enhancedResponseDetection } from './response-detector.ts'
import {
  analyzeConversationContext,
  isAutomatedFollowup,
  shouldCreateNewTrackedEmail,
  logConversationDecision
} from './conversation-tracker.ts'
import {
  getMailboxByUserId,
  insertTrackedEmail,
  logDetectionAttempt
} from './database-manager.ts'
import { detectBounce, processBounce } from './bounce-detector.ts'

/**
 * Traite une notification individuelle
 */
export async function processNotification(
  supabase: EdgeSupabaseClient,
  notification: MicrosoftGraphWebhookNotification
): Promise<DetectionResult> {
  const startTime = Date.now()
  console.log(`Processing notification: ${notification.changeType} for ${notification.resource}`)

  // Vérifier que c'est bien un message email
  if (!shouldProcessNotification(notification)) {
    return {
      detected: false,
      type: 'not_detected',
      rejectionReason: 'not_email_notification'
    }
  }

  try {
    // Extraire les identifiants
    const { userId, messageId } = extractResourceIdentifiers(notification.resource)
    if (!userId || !messageId) {
      throw new Error('Could not extract user ID and message ID from resource')
    }

    // Créer le contexte de notification
    const context: NotificationContext = {
      notification,
      userId,
      messageId,
      startTime
    }

    // Récupérer les détails du message
    const messageDetails = await getMessageDetails(userId, messageId)
    if (!messageDetails) {
      console.warn(`Could not fetch message details for ${messageId}`)
      return {
        detected: false,
        type: 'not_detected',
        rejectionReason: 'message_details_unavailable'
      }
    }

    // Check if this is a bounce/NDR first
    const bounceResult = await detectBounce(supabase, messageDetails)
    if (bounceResult.isNDR) {
      console.log(`🔔 Bounce detected: ${bounceResult.bounceType} bounce for ${messageId}`)

      // Process and store the bounce
      await processBounce(supabase, messageDetails, bounceResult)

      // Log the detection
      await logDetectionAttempt(
        supabase,
        messageDetails,
        true,
        bounceResult.originalEmailId || null,
        'bounce_detected',
        `${bounceResult.bounceType}_bounce`,
        getElapsedTime(startTime)
      )

      return {
        detected: true,
        type: 'bounce_detected',
        trackedEmailId: bounceResult.originalEmailId,
        detectionMethod: `ndr_${bounceResult.bounceType}_bounce`
      }
    }

    // Vérifier si l'email doit être exclu
    if (await shouldExcludeEmail(supabase, messageDetails)) {
      console.log(`Email ${messageId} excluded (internal email)`)
      await logDetectionAttempt(
        supabase,
        messageDetails,
        false,
        null,
        'not_detected',
        'internal_email',
        getElapsedTime(startTime)
      )
      return {
        detected: false,
        type: 'not_detected',
        rejectionReason: 'internal_email'
      }
    }

    // Récupérer la mailbox
    const mailbox = await getMailboxByUserId(supabase, userId)
    if (!mailbox) {
      console.warn(`No mailbox found for user ${userId}`)
      return {
        detected: false,
        type: 'not_detected',
        rejectionReason: 'mailbox_not_found'
      }
    }

    // Traiter selon le type d'email
    return await processEmailByType(supabase, messageDetails, mailbox, context)

  } catch (error) {
    console.error('Error processing notification:', error)
    return {
      detected: false,
      type: 'response_error',
      rejectionReason: error instanceof Error ? error.message : 'processing_error'
    }
  }
}

/**
 * Détermine si une notification doit être traitée
 */
function shouldProcessNotification(notification: MicrosoftGraphWebhookNotification): boolean {
  // Vérifier que c'est bien un message email
  if (!notification.resource.includes('/Messages/') && !notification.resource.includes('/messages/')) {
    console.log('Notification is not for an email message, skipping')
    console.log(`Resource received: ${notification.resource}`)
    return false
  }

  // Seuls les emails créés nous intéressent
  if (notification.changeType !== 'created') {
    console.log(`Notification type ${notification.changeType} not relevant for tracking`)
    return false
  }

  return true
}

/**
 * Traite un email selon son type
 */
async function processEmailByType(
  supabase: EdgeSupabaseClient,
  messageDetails: EmailMessage,
  mailbox: MailboxRow,
  context: NotificationContext
): Promise<DetectionResult> {
  const emailType = classifyEmailType(messageDetails, mailbox)
  console.log(`Email classified as: ${emailType}`)

  if (emailType === 'unknown') {
    console.log(`Unable to classify email ${messageDetails.id}, skipping`)
    return {
      detected: false,
      type: 'not_detected',
      rejectionReason: 'classification_failed'
    }
  }

  if (emailType === 'outgoing') {
    return await processOutgoingEmail(supabase, messageDetails, mailbox, context)
  } else if (emailType === 'incoming') {
    return await processIncomingEmail(supabase, messageDetails, context)
  }

  return {
    detected: false,
    type: 'not_detected',
    rejectionReason: 'unknown_email_type'
  }
}

/**
 * Traite un email sortant avec détection avancée de conversation
 */
async function processOutgoingEmail(
  supabase: EdgeSupabaseClient,
  messageDetails: EmailMessage,
  mailbox: MailboxRow,
  context: NotificationContext
): Promise<DetectionResult> {
  console.log(`Processing outgoing email: ${messageDetails.subject}`)

  // Analyser le contexte de conversation
  const conversationContext = await analyzeConversationContext(supabase, messageDetails)
  console.log(`Conversation context: position=${conversationContext.threadPosition}, hasExisting=${conversationContext.hasExistingTrackedEmails}`)

  // Vérifier si on doit créer un nouvel email tracké
  const trackingDecision = await shouldCreateNewTrackedEmail(supabase, messageDetails, conversationContext)

  // Logger la décision
  await logConversationDecision(
    supabase,
    messageDetails,
    conversationContext,
    trackingDecision.reason,
    { shouldCreate: trackingDecision.shouldCreate, existingEmailId: trackingDecision.existingEmailId }
  )

  if (!trackingDecision.shouldCreate) {
    console.log(`📝 Email not tracked: ${trackingDecision.reason}`)

    // Si c'est un followup automatique, le logger spécifiquement
    const followupCheck = isAutomatedFollowup(messageDetails)
    if (followupCheck.isFollowup) {
      console.log(`🔄 Automated followup #${followupCheck.followupNumber} detected for email ${followupCheck.trackedEmailId}`)
    }

    await logDetectionAttempt(
      supabase,
      messageDetails,
      false,
      trackingDecision.existingEmailId || null,
      'not_tracked',
      trackingDecision.reason,
      getElapsedTime(context.startTime)
    )

    return {
      detected: false,
      type: 'not_tracked',
      rejectionReason: trackingDecision.reason
    }
  }

  // Créer le nouvel email tracké
  const trackedEmailId = await insertTrackedEmail(supabase, messageDetails, mailbox.id)
  if (!trackedEmailId) {
    return {
      detected: false,
      type: 'response_error',
      rejectionReason: 'insert_failed'
    }
  }

  // Log de la détection réussie
  await logDetectionAttempt(
    supabase,
    messageDetails,
    true,
    trackedEmailId,
    'outgoing_tracked',
    null,
    getElapsedTime(context.startTime)
  )

  console.log(`✅ Successfully tracked NEW outgoing email: ${messageDetails.subject}`)
  console.log(`   Conversation ID: ${messageDetails.conversationId}`)
  console.log(`   Thread position: ${conversationContext.threadPosition}`)

  return {
    detected: true,
    type: 'outgoing_tracked',
    trackedEmailId,
    detectionMethod: 'new_conversation_starter'
  }
}

/**
 * Traite un email entrant avec détection améliorée
 */
async function processIncomingEmail(
  supabase: EdgeSupabaseClient,
  messageDetails: EmailMessage,
  context: NotificationContext
): Promise<DetectionResult> {
  console.log(`Processing incoming email: ${messageDetails.subject}`)

  // Utiliser la détection améliorée des réponses
  const responseDetection = await enhancedResponseDetection(supabase, messageDetails)

  console.log(`Response detection: isResponse=${responseDetection.isResponse}, confidence=${responseDetection.confidence}%, method=${responseDetection.method}`)

  if (responseDetection.isResponse) {
    console.log(`✅ Detected reply email with ${responseDetection.confidence}% confidence: ${messageDetails.subject}`)

    // Si on a trouvé l'email original
    if (responseDetection.originalEmailId) {
      console.log(`   Original email found: ${responseDetection.originalEmailId}`)

      // Insérer la réponse directement avec identifiants Microsoft pour thread
      const { error } = await supabase
        .from('email_responses')
        .insert({
          tracked_email_id: responseDetection.originalEmailId,
          microsoft_message_id: messageDetails.id,

          // Identifiants Microsoft pour charger le thread complet via Graph API
          conversation_id: messageDetails.conversationId,
          internet_message_id: messageDetails.internetMessageId,

          // Métadonnées minimales
          sender_email: messageDetails.sender.emailAddress.address,
          subject: messageDetails.subject,
          body_preview: messageDetails.bodyPreview,
          received_at: messageDetails.sentDateTime,
          response_type: 'direct_reply',
          is_auto_response: false
        })

      if (!error) {
        await logDetectionAttempt(
          supabase,
          messageDetails,
          true,
          responseDetection.originalEmailId,
          'response_detected',
          null,
          getElapsedTime(context.startTime)
        )

        return {
          detected: true,
          type: 'response_detected',
          trackedEmailId: responseDetection.originalEmailId,
          detectionMethod: responseDetection.method
        }
      }
    }

    // Sinon utiliser la méthode standard
    return await handleEmailResponse(supabase, messageDetails, context.startTime)
  }

  console.log(`Incoming email is not a reply (confidence: ${responseDetection.confidence}%), ignoring: ${messageDetails.subject}`)
  await logDetectionAttempt(
    supabase,
    messageDetails,
    false,
    null,
    'incoming_not_reply',
    `not_a_reply_confidence_${responseDetection.confidence}`,
    getElapsedTime(context.startTime)
  )

  return {
    detected: false,
    type: 'incoming_not_reply',
    rejectionReason: 'not_a_reply'
  }
}

/**
 * Traite un batch de notifications
 */
export async function processNotificationBatch(
  supabase: EdgeSupabaseClient,
  notifications: MicrosoftGraphWebhookNotification[]
): Promise<ProcessingStats> {
  console.log(`Processing batch of ${notifications.length} notifications`)

  const results = await Promise.allSettled(
    notifications.map(notification =>
      processNotification(supabase, notification)
    )
  )

  // Comptage des résultats
  const successful = results.filter(r =>
    r.status === 'fulfilled' && r.value.detected
  ).length

  const failed = results.filter(r =>
    r.status === 'rejected'
  ).length

  const processed = notifications.length

  console.log(`Batch processing complete: ${processed} processed, ${successful} successful, ${failed} failed`)

  return {
    success: true,
    processed,
    successful,
    failed
  }
}