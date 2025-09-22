// Export all types from centralized location
export * from "./database.types";
export * from "./auth";

// Re-export commonly used types for convenience
export type { Database } from "./database.types";
export type { User, UserRole, AuthUser, AuthContextType } from "./auth";

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
