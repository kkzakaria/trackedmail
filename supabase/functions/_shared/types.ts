/**
 * Types partagés pour les Edge Functions Supabase
 * Définitions TypeScript pour remplacer les types explicitement typés
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

/**
 * Interfaces pour la base de données
 */
export interface Database {
  public: {
    Tables: {
      mailboxes: {
        Row: {
          id: string
          email_address: string
          display_name: string
          microsoft_user_id: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['mailboxes']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['mailboxes']['Insert']>
      }
      tracked_emails: {
        Row: {
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
          importance: 'low' | 'normal' | 'high'
          status: 'pending' | 'responded' | 'stopped' | 'max_reached' | 'bounced' | 'expired'
          sent_at: string
          is_reply: boolean
          thread_position: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tracked_emails']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tracked_emails']['Insert']>
      }
      webhook_subscriptions: {
        Row: {
          id: string
          subscription_id: string
          resource: string
          change_type: string
          notification_url: string
          expiration_date_time: string
          client_state: string
          mailbox_id: string
          include_resource_data: boolean
          is_active: boolean
          renewal_count: number
          last_renewed_at?: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['webhook_subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['webhook_subscriptions']['Insert']>
      }
      microsoft_graph_tokens: {
        Row: {
          id: string
          token_type: string
          encrypted_token: string
          expires_at: string
          scope: string
          last_refreshed_at: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['microsoft_graph_tokens']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['microsoft_graph_tokens']['Insert']>
      }
      webhook_events: {
        Row: {
          id: string
          source: string
          event_type: string
          payload: Record<string, unknown>
          headers: Record<string, unknown>
          notification_count: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['webhook_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['webhook_events']['Insert']>
      }
      detection_logs: {
        Row: {
          id: string
          microsoft_message_id: string
          conversation_id: string
          is_response: boolean
          tracked_email_id?: string
          detection_method: string
          rejection_reason?: string
          detection_time_ms: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['detection_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['detection_logs']['Insert']>
      }
      message_headers: {
        Row: {
          id: string
          tracked_email_id: string
          header_name: string
          header_value: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['message_headers']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['message_headers']['Insert']>
      }
      system_config: {
        Row: {
          id: string
          key: string
          value: string
          description?: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['system_config']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['system_config']['Insert']>
      }
    }
  }
}

/**
 * Client Supabase typé avec le schéma de base de données
 */
export type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Client Supabase typé pour les Edge Functions (compatibilité)
 */
export type EdgeSupabaseClient = SupabaseClient

/**
 * Types pour les réponses de base de données
 */
export type MailboxRow = Database['public']['Tables']['mailboxes']['Row']
export type TrackedEmailRow = Database['public']['Tables']['tracked_emails']['Row']
export type WebhookSubscriptionRow = Database['public']['Tables']['webhook_subscriptions']['Row']
export type MicrosoftGraphTokenRow = Database['public']['Tables']['microsoft_graph_tokens']['Row']
export type WebhookEventRow = Database['public']['Tables']['webhook_events']['Row']
export type DetectionLogRow = Database['public']['Tables']['detection_logs']['Row']
export type MessageHeaderRow = Database['public']['Tables']['message_headers']['Row']
export type SystemConfigRow = Database['public']['Tables']['system_config']['Row']

/**
 * Types pour les insertions en base de données
 */
export type MailboxInsert = Database['public']['Tables']['mailboxes']['Insert']
export type TrackedEmailInsert = Database['public']['Tables']['tracked_emails']['Insert']
export type WebhookSubscriptionInsert = Database['public']['Tables']['webhook_subscriptions']['Insert']
export type MicrosoftGraphTokenInsert = Database['public']['Tables']['microsoft_graph_tokens']['Insert']
export type WebhookEventInsert = Database['public']['Tables']['webhook_events']['Insert']
export type DetectionLogInsert = Database['public']['Tables']['detection_logs']['Insert']
export type MessageHeaderInsert = Database['public']['Tables']['message_headers']['Insert']
export type SystemConfigInsert = Database['public']['Tables']['system_config']['Insert']

/**
 * Interface pour les tokens Microsoft Graph avec status
 */
export interface TokenWithStatus extends MicrosoftGraphTokenRow {
  isExpired: boolean
  expiresInMinutes: number
}

/**
 * Interface pour les abonnements avec mailbox info
 */
export interface SubscriptionWithMailbox extends WebhookSubscriptionRow {
  mailboxes?: {
    email_address: string
    display_name: string
  }
}