// Export all types from centralized location
export * from "./database.types";
export * from "./auth";

// Re-export commonly used types for convenience
export type { Database } from "./database.types";
export type { User, UserRole, AuthUser, AuthContextType } from "./auth";

// Tracked Email types with enhanced data
export interface TrackedEmailWithDetails {
  id: string;
  microsoft_message_id: string;
  conversation_id: string | null;
  subject: string;
  sender_email: string;
  recipient_emails: string[];
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  body_preview: string | null;
  status: EmailStatus;
  sent_at: string;
  responded_at: string | null;
  stopped_at: string | null;
  has_attachments: boolean | null;
  importance: EmailImportance | null;

  // Relations
  mailbox: {
    id: string;
    email_address: string;
    display_name: string | null;
  } | null;

  // Aggregated data
  response_count: number;
  followup_count: number;
  last_followup_sent: string | null;
  days_since_sent: number;
}

// Additional application types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Email tracking types
export type EmailStatus =
  | "pending"
  | "responded"
  | "stopped"
  | "max_reached"
  | "bounced"
  | "expired";
export type FollowupStatus = "scheduled" | "sent" | "failed" | "cancelled";
export type ResponseType = "direct_reply" | "forward" | "auto_reply" | "bounce";
export type EmailImportance = "low" | "normal" | "high";

// System configuration types
export interface WorkingHours {
  timezone: string;
  start: string;
  end: string;
  working_days: string[];
  holidays: string[];
}

export interface FollowupSettings {
  max_followups: number;
  default_interval_hours: number;
  stop_after_days: number;
  stop_on_bounce: boolean;
  stop_on_unsubscribe: boolean;
}
