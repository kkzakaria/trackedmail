/**
 * Types partagés pour followup-processor
 * Définitions TypeScript pour la gestion des relances
 */

import type { EdgeSupabaseClient } from '../_shared/types.ts'

/**
 * Paramètres de la requête de traitement du créneau horaire
 */
export interface TimeSlotProcessor {
  time_slot: '07:00' | '12:00' | '16:00'
  source?: string
  timestamp?: string
}

/**
 * Email éligible pour un créneau horaire
 */
export interface EmailEligibleForSlot {
  id: string
  sender_email: string
  recipient_emails: string[]
  subject: string
  body_preview?: string
  sent_at: string
  status: string
  last_followup_number: number
  next_followup_number: number
  last_followup_at?: string
  last_activity_at: string
  last_activity_type: 'automatic' | 'manual' | 'original'
  total_followups: number
  followups_sent_today: number
  mailbox: {
    id: string
    email_address: string
    microsoft_user_id: string
  }
}

/**
 * Template de relance
 */
export interface FollowupTemplate {
  id: string
  name: string
  subject: string
  body: string
  followup_number: number
  delay_hours: number
  is_active: boolean
}

/**
 * Statistiques de traitement d'un créneau
 */
export interface ProcessingStats {
  success: boolean
  message: string
  time_slot: string
  emails_analyzed: number
  emails_eligible: number
  followups_sent: number
  followups_failed: number
  errors?: string[]
}

/**
 * Configuration des followups
 */
export interface FollowupConfig {
  max_followups: number
  max_per_day: number
  followup_1: number
  followup_2: number
  followup_3: number
  followup_4: number
  total_timeframe_hours: number
  min_delay_hours?: {
    [key: string]: number
  }
  working_hours: {
    start: string
    end: string
    timezone: string
  }
}

/**
 * Informations de followup pour un email
 */
export interface FollowupInfo {
  last_followup_number: number
  next_followup_number: number
  last_followup_at?: string
  last_activity_at: string
  last_activity_type: 'automatic' | 'manual' | 'original'
  total_followups: number
  followups_sent_today: number
}

/**
 * Email avec informations de mailbox
 */
export interface TrackedEmailWithMailbox {
  id: string
  sender_email: string
  recipient_emails: string[]
  subject: string
  body_preview?: string
  sent_at: string
  status: string
  mailbox: {
    id: string
    email_address: string
    microsoft_user_id: string
    is_active: boolean
  }
}

/**
 * Template rendu avec variables remplacées
 */
export interface RenderedTemplate {
  subject: string
  body: string
}

/**
 * Variables disponibles pour le rendu des templates
 */
export interface TemplateVariables {
  // Variables françaises (compatibilité)
  destinataire_nom: string
  destinataire_entreprise: string
  objet_original: string
  date_envoi_original: string
  numero_relance: number
  jours_depuis_envoi: number
  expediteur_nom: string
  expediteur_email: string
  // Variables anglaises
  recipient_name: string
  recipient_company: string
  original_subject: string
  original_message: string
  sender_name: string
  sender_email: string
}

export type { EdgeSupabaseClient }