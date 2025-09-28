/**
 * Types partagés pour le webhook Microsoft Graph
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Re-export types from shared
export type { EdgeSupabaseClient, MailboxRow } from '../_shared/types.ts'

/**
 * Interface pour les notifications webhook Microsoft Graph
 */
export interface MicrosoftGraphWebhookNotification {
  subscriptionId: string
  changeType: 'created' | 'updated' | 'deleted'
  tenantId: string
  clientState: string
  subscriptionExpirationDateTime: string
  resource: string
  resourceData: {
    '@odata.type': string
    '@odata.id': string
    '@odata.etag'?: string
    id: string
  }
}

/**
 * Payload du webhook
 */
export interface WebhookPayload {
  value: MicrosoftGraphWebhookNotification[]
  validationTokens?: string[]
}

/**
 * Notification avec chiffrement
 */
export interface NotificationWithEncryption extends MicrosoftGraphWebhookNotification {
  encryptedContent?: string
  dataSignature?: string
}

/**
 * Message email depuis Microsoft Graph
 */
export interface EmailMessage {
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
}

/**
 * Configuration tenant pour exclusion emails internes
 */
export interface TenantConfig {
  domain: string
  microsoft_tenant_id: string
  exclude_internal_emails: boolean
}

/**
 * Types de classification d'emails
 */
export type EmailClassification = 'outgoing' | 'incoming' | 'unknown'

/**
 * Types de réponses
 */
export type ResponseType = 'direct_reply' | 'forward' | 'auto_reply' | 'bounce'

/**
 * Résultat de détection de bounce
 */
export interface BounceDetection {
  isBounce: boolean
  bounceType?: 'hard' | 'soft'
  reason?: string
}

/**
 * Email tracké enrichi
 */
export interface TrackedEmail {
  id: string
  microsoft_message_id: string
  conversation_id: string
  conversation_index?: string
  internet_message_id: string
  in_reply_to?: string
  references?: string
  mailbox_id: string
  subject: string
  sender_email: string
  recipient_emails: string[]
  cc_emails?: string[]
  body_preview: string
  has_attachments: boolean
  importance: string
  status: 'pending' | 'responded' | 'stopped' | 'max_reached' | 'bounced' | 'expired'
  sent_at: string
  is_reply: boolean
  thread_position: number
  responded_at?: string
}

/**
 * Statistiques de traitement
 */
export interface ProcessingStats {
  success: boolean
  processed: number
  successful: number
  failed: number
  message?: string
  errors?: string[]
}

/**
 * Contexte de sécurité
 */
export interface SecurityContext {
  isValid: boolean
  validationType?: 'jwt' | 'hmac' | 'clientState' | 'timestamp'
  failureReason?: string
  metadata?: Record<string, unknown>
}

/**
 * Contexte de traitement de notification
 */
export interface NotificationContext {
  notification: MicrosoftGraphWebhookNotification
  userId: string
  messageId: string
  startTime: number
  skipReason?: string
}

/**
 * Résultat de détection
 */
export interface DetectionResult {
  detected: boolean
  type: 'outgoing_tracked' | 'response_detected' | 'followup_skipped' | 'manual_followup_detected' | 'incoming_not_reply' | 'response_orphaned' | 'response_error' | 'not_detected'
  trackedEmailId?: string
  detectionMethod?: string
  rejectionReason?: string
}

/**
 * Configuration du système
 */
export interface SystemConfig {
  followup_enabled: boolean
  max_followups: number
  followup_interval_hours: number
  working_hours_start: number
  working_hours_end: number
  timezone: string
  exclude_internal_emails: boolean
}