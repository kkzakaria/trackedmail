/**
 * Types partagés pour Mailbox Email Processor Edge Function
 */

import { createClient } from '@supabase/supabase-js'

export type EdgeSupabaseClient = ReturnType<typeof createClient>

/**
 * Interface pour les paramètres de la fonction
 */
export interface ProcessorRequest {
  startDate: string
  endDate: string
  mailboxIds?: string[]
  processResponses?: boolean
  dryRun?: boolean
  requireSpecificMailboxes?: boolean
}

/**
 * Interface pour les statistiques du traitement
 */
export interface ProcessingStats {
  mailboxesProcessed: number
  totalEmailsFound: number
  outgoingEmails: number
  incomingEmails: number
  trackedEmailsInserted: number
  responsesDetected: number
  skippedEmails: number
  errors: string[]
  processedMailboxes: {
    mailboxId: string
    emailAddress: string
    emailsFound: number
    trackedInserted: number
    responsesFound: number
    skippedEmails: number
  }[]
}

/**
 * Interface pour les statistiques de traitement d'une mailbox
 */
export interface MailboxProcessingResult {
  emailsFound: number
  outgoingCount: number
  incomingCount: number
  trackedInserted: number
  responsesFound: number
  skippedEmails: number
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
 * Type pour les données de mailbox
 */
export interface MailboxRow {
  id: string
  email_address: string
  display_name: string
  microsoft_user_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Type pour les données d'insertion de tracked email
 */
export interface TrackedEmailInsert {
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
  body_preview?: string
  has_attachments: boolean
  importance: string
  status: 'pending' | 'responded' | 'stopped' | 'max_reached' | 'bounced' | 'expired'
  sent_at: string
  is_reply: boolean
  thread_position: number
}