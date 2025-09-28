/**
 * Module de gestion des opérations base de données
 */

import {
  EdgeSupabaseClient,
  EmailMessage,
  MailboxRow,
  WebhookPayload
} from './shared-types.ts'
import { calculateThreadPosition } from './utils.ts'
import { detectIsReply } from './response-detector.ts'

/**
 * Récupère la mailbox par user ID Microsoft
 */
export async function getMailboxByUserId(
  supabase: EdgeSupabaseClient,
  microsoftUserId: string
): Promise<MailboxRow | null> {
  try {
    const { data, error } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('microsoft_user_id', microsoftUserId)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data
  } catch (error) {
    console.error(`Error getting mailbox for user ${microsoftUserId}:`, error)
    return null
  }
}

/**
 * Vérifie si un email est déjà suivi
 */
export async function getExistingTrackedEmail(
  supabase: EdgeSupabaseClient,
  internetMessageId: string
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabase
      .from('tracked_emails')
      .select('id')
      .eq('internet_message_id', internetMessageId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data
  } catch (error) {
    console.error(`Error checking existing tracked email:`, error)
    return null
  }
}

/**
 * Insère un nouvel email suivi
 */
export async function insertTrackedEmail(
  supabase: EdgeSupabaseClient,
  message: EmailMessage,
  mailboxId: string
): Promise<string | null> {
  try {
    const recipientEmails = message.toRecipients.map(r => r.emailAddress.address)
    const ccEmails = message.ccRecipients?.map(r => r.emailAddress.address) || []

    const { data, error } = await supabase
      .from('tracked_emails')
      .insert({
        microsoft_message_id: message.id,
        conversation_id: message.conversationId,
        conversation_index: message.conversationIndex,
        internet_message_id: message.internetMessageId,
        in_reply_to: message.inReplyTo,
        references: message.references,
        mailbox_id: mailboxId,
        subject: message.subject,
        sender_email: message.sender.emailAddress.address,
        recipient_emails: recipientEmails,
        cc_emails: ccEmails.length > 0 ? ccEmails : null,
        body_preview: message.bodyPreview,
        has_attachments: message.hasAttachments,
        importance: message.importance,
        status: 'pending',
        sent_at: message.sentDateTime,
        is_reply: detectIsReply(message),
        thread_position: calculateThreadPosition(message.conversationIndex)
      })
      .select('id')
      .single()

    if (error) {
      throw error
    }

    // Stocker les headers importants si disponibles
    if (data && message.internetMessageHeaders && message.internetMessageHeaders.length > 0) {
      await storeMessageHeaders(supabase, data.id, message.internetMessageHeaders)
    }

    return data?.id || null

  } catch (error) {
    console.error('Error inserting tracked email:', error)
    throw error
  }
}

/**
 * Stocke les headers d'email importants
 */
export async function storeMessageHeaders(
  supabase: EdgeSupabaseClient,
  trackedEmailId: string,
  headers: Array<{name: string, value: string}>
): Promise<void> {
  try {
    // Headers importants pour la détection
    const importantHeaders = [
      'Message-ID',
      'In-Reply-To',
      'References',
      'Thread-Topic',
      'Thread-Index',
      'Auto-Submitted',
      'X-Auto-Response-Suppress',
      'X-TrackedMail-Followup',
      'X-TrackedMail-System',
      'X-TrackedMail-Data'
    ]

    const headersToStore = headers.filter(h =>
      importantHeaders.some(important =>
        h.name.toLowerCase() === important.toLowerCase()
      )
    )

    if (headersToStore.length === 0) {
      return
    }

    const { error } = await supabase
      .from('message_headers')
      .insert(
        headersToStore.map(header => ({
          tracked_email_id: trackedEmailId,
          header_name: header.name,
          header_value: header.value
        }))
      )

    if (error) {
      console.warn('Failed to store message headers:', error)
    }
  } catch (error) {
    console.warn('Error storing message headers:', error)
  }
}

/**
 * Log une tentative de détection pour monitoring
 */
export async function logDetectionAttempt(
  supabase: EdgeSupabaseClient,
  message: EmailMessage,
  isResponse: boolean,
  trackedEmailId: string | null,
  detectionMethod: string,
  rejectionReason: string | null,
  detectionTimeMs: number
): Promise<void> {
  try {
    await supabase
      .from('detection_logs')
      .insert({
        microsoft_message_id: message.id,
        conversation_id: message.conversationId,
        is_response: isResponse,
        tracked_email_id: trackedEmailId,
        detection_method: detectionMethod,
        rejection_reason: rejectionReason,
        detection_time_ms: detectionTimeMs
      })
  } catch (error) {
    console.warn('Failed to log detection attempt:', error)
  }
}

/**
 * Log l'événement webhook pour traçabilité
 */
export async function logWebhookEvent(
  supabase: EdgeSupabaseClient,
  payload: WebhookPayload,
  req: Request
): Promise<void> {
  try {
    const userAgent = req.headers.get('User-Agent') || 'Unknown'
    const xForwardedFor = req.headers.get('X-Forwarded-For')

    await supabase
      .from('webhook_events')
      .insert({
        source: 'microsoft_graph',
        event_type: 'notification_received',
        payload: payload,
        headers: {
          'user-agent': userAgent,
          'x-forwarded-for': xForwardedFor
        },
        notification_count: payload.value?.length || 0
      })
  } catch (error) {
    console.warn('Failed to log webhook event:', error)
  }
}

/**
 * Vérifie si le système de relances est activé
 */
export async function checkFollowupSystemEnabled(
  supabase: EdgeSupabaseClient
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'followup_enabled')
      .single()

    if (error || !data) {
      console.log('Followup system config not found, defaulting to enabled')
      return true
    }

    return data.value === true || data.value === 'true'
  } catch (error) {
    console.error('Error checking followup system status:', error)
    return true // Par défaut, activé
  }
}

/**
 * Récupère la configuration système
 */
export async function getSystemConfig(
  supabase: EdgeSupabaseClient,
  key: string
): Promise<unknown> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', key)
      .single()

    if (error || !data) {
      return null
    }

    return data.value
  } catch (error) {
    console.error(`Error getting system config for key ${key}:`, error)
    return null
  }
}

/**
 * Met à jour les statistiques de traitement
 */
export async function updateProcessingStats(
  supabase: EdgeSupabaseClient,
  stats: {
    processed: number
    successful: number
    failed: number
  }
): Promise<void> {
  try {
    const currentDate = new Date().toISOString().split('T')[0]

    // Upsert les statistiques journalières
    await supabase
      .from('processing_stats')
      .upsert({
        date: currentDate,
        webhook_notifications: stats.processed,
        emails_tracked: stats.successful,
        errors: stats.failed,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'date'
      })
  } catch (error) {
    console.warn('Failed to update processing stats:', error)
  }
}