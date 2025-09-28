/**
 * Module de traitement des notifications webhook
 */

import {
  EdgeSupabaseClient,
  MicrosoftGraphWebhookNotification,
  NotificationContext,
  EmailMessage,
  DetectionResult,
  ProcessingStats
} from './shared-types.ts'
import { extractResourceIdentifiers, getElapsedTime } from './utils.ts'
import { getMessageDetails } from './message-fetcher.ts'
import { classifyEmailType, shouldExcludeEmail } from './email-classifier.ts'
import { detectIsReply, handleEmailResponse } from './response-detector.ts'
import {
  isFollowupEmail,
  getFollowupNumber,
  getOriginalTrackedEmailId,
  handlePotentialManualFollowup
} from './followup-detector.ts'
import {
  getMailboxByUserId,
  getExistingTrackedEmail,
  insertTrackedEmail,
  logDetectionAttempt
} from './database-manager.ts'

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
  mailbox: any,
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
 * Traite un email sortant
 */
async function processOutgoingEmail(
  supabase: EdgeSupabaseClient,
  messageDetails: EmailMessage,
  mailbox: any,
  context: NotificationContext
): Promise<DetectionResult> {
  console.log(`Processing outgoing email: ${messageDetails.subject}`)

  // Vérifier si c'est une relance automatique
  if (isFollowupEmail(messageDetails)) {
    const followupNumber = getFollowupNumber(messageDetails)
    const originalId = getOriginalTrackedEmailId(messageDetails)

    console.log(`🔄 Automated followup detected, skipping tracking`)
    console.log(`   Headers indicate followup #${followupNumber} for tracked email ${originalId}`)

    await logDetectionAttempt(
      supabase,
      messageDetails,
      false,
      originalId,
      'followup_skipped',
      'automated_followup',
      getElapsedTime(context.startTime)
    )

    return {
      detected: false,
      type: 'followup_skipped',
      rejectionReason: 'automated_followup'
    }
  }

  // Détecter les relances manuelles
  if (detectIsReply(messageDetails) && messageDetails.conversationId) {
    console.log(`🔍 Detected reply email, checking for manual followup: ${messageDetails.subject}`)

    const manualFollowupResult = await handlePotentialManualFollowup(
      supabase,
      messageDetails,
      context.startTime
    )

    if (manualFollowupResult.detected) {
      console.log(`✅ Manual followup detected and processed for conversation: ${messageDetails.conversationId}`)
      return manualFollowupResult
    }
  }

  // Vérifier si l'email n'existe pas déjà
  const existingEmail = await getExistingTrackedEmail(supabase, messageDetails.internetMessageId)
  if (existingEmail) {
    console.log(`Email ${messageDetails.internetMessageId} already tracked`)
    return {
      detected: false,
      type: 'not_detected',
      rejectionReason: 'already_tracked'
    }
  }

  // Traiter comme un nouvel email à tracker
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

  console.log(`Successfully tracked new outgoing email: ${messageDetails.subject}`)

  return {
    detected: true,
    type: 'outgoing_tracked',
    trackedEmailId,
    detectionMethod: 'sender_matching'
  }
}

/**
 * Traite un email entrant
 */
async function processIncomingEmail(
  supabase: EdgeSupabaseClient,
  messageDetails: EmailMessage,
  context: NotificationContext
): Promise<DetectionResult> {
  console.log(`Processing incoming email: ${messageDetails.subject}`)

  // Vérifier si c'est une réponse à un email tracké
  if (detectIsReply(messageDetails)) {
    console.log(`Detected reply email: ${messageDetails.subject}`)
    return await handleEmailResponse(supabase, messageDetails, context.startTime)
  }

  console.log(`Incoming email is not a reply, ignoring: ${messageDetails.subject}`)
  await logDetectionAttempt(
    supabase,
    messageDetails,
    false,
    null,
    'incoming_not_reply',
    'not_a_reply',
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