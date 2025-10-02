import {
  EdgeSupabaseClient,
  TrackedEmailRow,
  FollowupTemplateRow,
} from "../_shared/types.ts";

/**
 * Configuration des heures ouvrables
 */
export interface WorkingHoursConfig {
  timezone: string;
  start: string;
  end: string;
  working_days: string[];
  holidays: string[];
}

/**
 * Résultat du calcul de planification
 */
export interface SchedulingResult {
  scheduled_for: string;
  original_target: string;
  adjusted_for_working_hours: boolean;
  delay_applied_hours: number;
}

/**
 * Email enrichi avec informations de relances
 */
export interface TrackedEmailWithFollowupInfo extends TrackedEmailRow {
  last_followup_number?: number;
  last_followup_at?: string;
  last_manual_followup_at?: string;
  last_activity_at?: string;
  last_activity_type?: "automatic" | "manual" | "original";
  total_followups?: number;
}

/**
 * Statistiques de traitement
 */
export interface SchedulingStats {
  success: boolean;
  message: string;
  processed: number;
  emails_processed: number;
  errors?: string[];
}

/**
 * Template rendu avec variables
 */
export interface RenderedTemplate {
  subject: string;
  body: string;
}

/**
 * Variables disponibles pour le rendu des templates
 */
export interface TemplateVariables {
  destinataire_nom: string;
  destinataire_entreprise: string;
  objet_original: string;
  date_envoi_original: string;
  numero_relance: number;
  jours_depuis_envoi: number;
  expediteur_nom: string;
  expediteur_email: string;
}

/**
 * Données de relance automatique
 */
export interface FollowupData {
  followup_number: number;
  sent_at: string;
}

/**
 * Données de relance manuelle
 */
export interface ManualFollowupData {
  followup_sequence_number: number;
  detected_at: string;
}

/**
 * Status de bounce d'un email
 */
export interface EmailBounceStatus {
  has_bounced: boolean;
  bounce_type?: string;
  bounce_reason?: string;
  can_retry: boolean;
  retry_count: number;
}

/**
 * Type de client Supabase réexporté pour facilité d'usage
 */
export type { EdgeSupabaseClient, TrackedEmailRow, FollowupTemplateRow };
