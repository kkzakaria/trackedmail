import { Database } from "./database.types";

// Types de base de données (accès direct)
type FollowupTemplate =
  Database["public"]["Tables"]["followup_templates"]["Row"];
type Followup = Database["public"]["Tables"]["followups"]["Row"];

// Statuts des relances
export type FollowupStatus = "scheduled" | "sent" | "failed" | "cancelled";

// Types pour la configuration des heures ouvrables
export interface WorkingHoursConfig {
  timezone: string;
  start: string; // Format "HH:mm"
  end: string; // Format "HH:mm"
  working_days: Array<
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday"
  >;
  holidays: string[]; // Dates au format ISO
}

// Types pour la configuration des relances
export interface FollowupSettings {
  max_followups: number;
  default_interval_hours: number;
  stop_after_days: number;
  stop_on_bounce: boolean;
  stop_on_unsubscribe: boolean;
}

// Variables disponibles dans les templates
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

// Type pour les templates avec données étendues
export interface FollowupTemplateWithStats extends FollowupTemplate {
  usage_count?: number;
  last_used?: string | null;
  success_rate?: number;
}

// Type pour les relances avec données étendues
export interface FollowupWithEmail extends Followup {
  tracked_email?: {
    id: string;
    subject: string;
    sender_email: string;
    recipient_emails: string[];
    sent_at: string;
    status: string;
  };
  template?: {
    id: string;
    name: string;
    followup_number: number;
  };
}

// Type pour la planification des relances
export interface FollowupScheduleParams {
  tracked_email_id: string;
  template_id: string;
  followup_number: number;
  delay_hours?: number;
  force_schedule?: boolean; // Ignorer les heures ouvrables
}

// Type pour le rendu des templates
export interface TemplateRenderParams {
  template: FollowupTemplate;
  variables: Partial<TemplateVariables>;
  tracked_email_id: string;
}

// Type pour la validation des templates
export interface TemplateValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  rendered_preview?: {
    subject: string;
    body: string;
  };
}

// Type pour les statistiques de relances
export interface FollowupStatistics {
  total_sent: number;
  total_scheduled: number;
  total_failed: number;
  total_cancelled: number;
  success_rate: number;
  average_response_time_hours: number;
  by_template: Array<{
    template_id: string;
    template_name: string;
    sent_count: number;
    success_rate: number;
  }>;
  by_followup_number: Array<{
    followup_number: number;
    sent_count: number;
    success_rate: number;
  }>;
}

// Type pour la configuration du planning
export interface SchedulingOptions {
  respect_working_hours: boolean;
  timezone?: string;
  custom_working_hours?: Partial<WorkingHoursConfig>;
  exclude_dates?: string[]; // Dates à exclure (format ISO)
  min_delay_hours?: number;
  max_delay_hours?: number;
}

// Type pour les résultats de planification
export interface SchedulingResult {
  scheduled_for: string; // Date ISO
  original_target: string; // Date cible originale
  adjusted_for_working_hours: boolean;
  next_working_time?: string; // Si ajusté
  delay_applied_hours: number;
}

// Type pour les erreurs de relance
export interface FollowupError {
  error_code: string;
  error_message: string;
  retry_after?: number; // Seconds
  is_permanent: boolean;
  context?: Record<string, unknown>;
}

// Type pour le contexte d'envoi
export interface SendContext {
  mailbox_id: string;
  microsoft_user_id: string;
  access_token: string;
  user_timezone?: string;
}

// Type pour les métriques en temps réel
export interface FollowupMetrics {
  pending_count: number;
  scheduled_today: number;
  sent_today: number;
  failed_today: number;
  next_scheduled?: {
    datetime: string;
    count: number;
  };
  templates_performance: Array<{
    template_id: string;
    name: string;
    usage_last_7_days: number;
    success_rate_last_7_days: number;
  }>;
}

// Enum pour les types d'événements de relance
export enum FollowupEventType {
  SCHEDULED = "scheduled",
  SENT = "sent",
  FAILED = "failed",
  CANCELLED = "cancelled",
  RESCHEDULED = "rescheduled",
}

// Type pour les événements de relance (audit)
export interface FollowupEvent {
  id: string;
  followup_id: string;
  event_type: FollowupEventType;
  timestamp: string;
  details?: Record<string, unknown>;
  user_id?: string;
}

// Type pour les filtres de recherche
export interface FollowupFilters {
  status?: FollowupStatus[];
  template_id?: string;
  followup_number?: number;
  date_from?: string;
  date_to?: string;
  mailbox_id?: string;
  search_query?: string; // Recherche dans sujet/contenu
}

// Type pour la pagination
export interface PaginationParams {
  page: number;
  per_page: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

// Type pour les résultats paginés
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Type pour les query builders Supabase complexes
export type SupabaseQueryBuilder = unknown;

// Interface pour les objets contenant template_id et status
export interface FollowupStatsItem {
  status: string;
  followup_number: number;
  sent_at: string | null;
  template: {
    id: string;
    name: string;
  } | null;
  tracked_email: {
    mailbox_id: string | null;
    sent_at: string;
    responded_at: string | null;
  };
}

// Interface pour les données avec tracked_email et sent_at
export interface FollowupCalculationItem {
  sent_at: string | null;
  tracked_email: {
    sent_at: string;
    responded_at: string | null;
  };
}

// Type pour les valeurs JSON complexes de Supabase
export type SupabaseJsonValue = Record<string, unknown>;

// Type simple pour les stats de template (seulement template_id et status)
export interface SimpleFollowupStats {
  template_id: string | null;
  status: string;
}

// Export par défaut supprimé pour éviter les erreurs TypeScript strict
