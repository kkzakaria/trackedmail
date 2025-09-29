export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          created_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          ip_address: unknown | null;
          new_values: Json | null;
          old_values: Json | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown | null;
          new_values?: Json | null;
          old_values?: Json | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown | null;
          new_values?: Json | null;
          old_values?: Json | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      detection_logs: {
        Row: {
          conversation_id: string | null;
          created_at: string | null;
          detection_method: string | null;
          detection_time_ms: number | null;
          id: string;
          is_response: boolean;
          microsoft_message_id: string;
          rejection_reason: string | null;
          tracked_email_id: string | null;
        };
        Insert: {
          conversation_id?: string | null;
          created_at?: string | null;
          detection_method?: string | null;
          detection_time_ms?: number | null;
          id?: string;
          is_response: boolean;
          microsoft_message_id: string;
          rejection_reason?: string | null;
          tracked_email_id?: string | null;
        };
        Update: {
          conversation_id?: string | null;
          created_at?: string | null;
          detection_method?: string | null;
          detection_time_ms?: number | null;
          id?: string;
          is_response?: boolean;
          microsoft_message_id?: string;
          rejection_reason?: string | null;
          tracked_email_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "detection_logs_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_needing_followup";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "detection_logs_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_requiring_manual_handling";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "detection_logs_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "followup_activity_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "detection_logs_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "pending_response_detection";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "detection_logs_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "tracked_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      email_bounces: {
        Row: {
          bounce_category: string | null;
          bounce_code: string | null;
          bounce_reason: string | null;
          bounce_type: string;
          created_at: string | null;
          detected_at: string | null;
          diagnostic_code: string | null;
          failed_recipients: string[] | null;
          followups_cancelled: number | null;
          id: string;
          microsoft_message_id: string;
          ndr_headers: Json | null;
          ndr_received_at: string | null;
          ndr_sender: string | null;
          original_sent_at: string | null;
          original_subject: string | null;
          processed: boolean | null;
          processed_at: string | null;
          reporting_mta: string | null;
          tracked_email_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          bounce_category?: string | null;
          bounce_code?: string | null;
          bounce_reason?: string | null;
          bounce_type: string;
          created_at?: string | null;
          detected_at?: string | null;
          diagnostic_code?: string | null;
          failed_recipients?: string[] | null;
          followups_cancelled?: number | null;
          id?: string;
          microsoft_message_id: string;
          ndr_headers?: Json | null;
          ndr_received_at?: string | null;
          ndr_sender?: string | null;
          original_sent_at?: string | null;
          original_subject?: string | null;
          processed?: boolean | null;
          processed_at?: string | null;
          reporting_mta?: string | null;
          tracked_email_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          bounce_category?: string | null;
          bounce_code?: string | null;
          bounce_reason?: string | null;
          bounce_type?: string;
          created_at?: string | null;
          detected_at?: string | null;
          diagnostic_code?: string | null;
          failed_recipients?: string[] | null;
          followups_cancelled?: number | null;
          id?: string;
          microsoft_message_id?: string;
          ndr_headers?: Json | null;
          ndr_received_at?: string | null;
          ndr_sender?: string | null;
          original_sent_at?: string | null;
          original_subject?: string | null;
          processed?: boolean | null;
          processed_at?: string | null;
          reporting_mta?: string | null;
          tracked_email_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_bounces_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_needing_followup";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_bounces_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_requiring_manual_handling";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_bounces_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "followup_activity_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_bounces_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "pending_response_detection";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_bounces_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "tracked_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      email_responses: {
        Row: {
          body_content: string | null;
          body_preview: string | null;
          conversation_id: string | null;
          conversation_index: string | null;
          created_at: string | null;
          id: string;
          in_reply_to: string | null;
          internet_message_id: string | null;
          is_auto_response: boolean | null;
          microsoft_message_id: string;
          received_at: string;
          references: string | null;
          response_type: string | null;
          sender_email: string;
          subject: string | null;
          tracked_email_id: string | null;
        };
        Insert: {
          body_content?: string | null;
          body_preview?: string | null;
          conversation_id?: string | null;
          conversation_index?: string | null;
          created_at?: string | null;
          id?: string;
          in_reply_to?: string | null;
          internet_message_id?: string | null;
          is_auto_response?: boolean | null;
          microsoft_message_id: string;
          received_at: string;
          references?: string | null;
          response_type?: string | null;
          sender_email: string;
          subject?: string | null;
          tracked_email_id?: string | null;
        };
        Update: {
          body_content?: string | null;
          body_preview?: string | null;
          conversation_id?: string | null;
          conversation_index?: string | null;
          created_at?: string | null;
          id?: string;
          in_reply_to?: string | null;
          internet_message_id?: string | null;
          is_auto_response?: boolean | null;
          microsoft_message_id?: string;
          received_at?: string;
          references?: string | null;
          response_type?: string | null;
          sender_email?: string;
          subject?: string | null;
          tracked_email_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_responses_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_needing_followup";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_responses_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_requiring_manual_handling";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_responses_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "followup_activity_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_responses_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "pending_response_detection";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_responses_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "tracked_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      followup_templates: {
        Row: {
          available_variables: string[] | null;
          body: string;
          created_at: string | null;
          created_by: string | null;
          delay_hours: number | null;
          followup_number: number;
          id: string;
          is_active: boolean | null;
          name: string;
          subject: string;
          updated_at: string | null;
          version: number | null;
        };
        Insert: {
          available_variables?: string[] | null;
          body: string;
          created_at?: string | null;
          created_by?: string | null;
          delay_hours?: number | null;
          followup_number: number;
          id?: string;
          is_active?: boolean | null;
          name: string;
          subject: string;
          updated_at?: string | null;
          version?: number | null;
        };
        Update: {
          available_variables?: string[] | null;
          body?: string;
          created_at?: string | null;
          created_by?: string | null;
          delay_hours?: number | null;
          followup_number?: number;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          subject?: string;
          updated_at?: string | null;
          version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "followup_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "followup_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      followups: {
        Row: {
          body: string;
          created_at: string | null;
          failed_at: string | null;
          failure_reason: string | null;
          followup_number: number;
          id: string;
          microsoft_message_id: string | null;
          scheduled_for: string;
          sent_at: string | null;
          status: string;
          subject: string;
          template_id: string | null;
          tracked_email_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          body: string;
          created_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          followup_number: number;
          id?: string;
          microsoft_message_id?: string | null;
          scheduled_for: string;
          sent_at?: string | null;
          status?: string;
          subject: string;
          template_id?: string | null;
          tracked_email_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          body?: string;
          created_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          followup_number?: number;
          id?: string;
          microsoft_message_id?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: string;
          subject?: string;
          template_id?: string | null;
          tracked_email_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "followups_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "followup_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_needing_followup";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_requiring_manual_handling";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "followup_activity_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "pending_response_detection";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "tracked_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      mailboxes: {
        Row: {
          created_at: string | null;
          display_name: string | null;
          email_address: string;
          id: string;
          is_active: boolean | null;
          last_sync: string | null;
          microsoft_user_id: string | null;
          pause_followups: boolean;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          display_name?: string | null;
          email_address: string;
          id?: string;
          is_active?: boolean | null;
          last_sync?: string | null;
          microsoft_user_id?: string | null;
          pause_followups?: boolean;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          display_name?: string | null;
          email_address?: string;
          id?: string;
          is_active?: boolean | null;
          last_sync?: string | null;
          microsoft_user_id?: string | null;
          pause_followups?: boolean;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      manual_followups: {
        Row: {
          affects_automatic_scheduling: boolean | null;
          conversation_id: string;
          created_at: string | null;
          detected_at: string | null;
          followup_sequence_number: number;
          id: string;
          microsoft_message_id: string;
          sender_email: string;
          subject: string | null;
          tracked_email_id: string;
        };
        Insert: {
          affects_automatic_scheduling?: boolean | null;
          conversation_id: string;
          created_at?: string | null;
          detected_at?: string | null;
          followup_sequence_number: number;
          id?: string;
          microsoft_message_id: string;
          sender_email: string;
          subject?: string | null;
          tracked_email_id: string;
        };
        Update: {
          affects_automatic_scheduling?: boolean | null;
          conversation_id?: string;
          created_at?: string | null;
          detected_at?: string | null;
          followup_sequence_number?: number;
          id?: string;
          microsoft_message_id?: string;
          sender_email?: string;
          subject?: string | null;
          tracked_email_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manual_followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_needing_followup";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_requiring_manual_handling";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "followup_activity_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "pending_response_detection";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_followups_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "tracked_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      message_headers: {
        Row: {
          created_at: string | null;
          email_response_id: string | null;
          header_name: string;
          header_value: string | null;
          id: string;
          tracked_email_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          email_response_id?: string | null;
          header_name: string;
          header_value?: string | null;
          id?: string;
          tracked_email_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          email_response_id?: string | null;
          header_name?: string;
          header_value?: string | null;
          id?: string;
          tracked_email_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_headers_email_response_id_fkey";
            columns: ["email_response_id"];
            isOneToOne: false;
            referencedRelation: "email_responses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_headers_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_needing_followup";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_headers_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "emails_requiring_manual_handling";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_headers_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "followup_activity_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_headers_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "pending_response_detection";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_headers_tracked_email_id_fkey";
            columns: ["tracked_email_id"];
            isOneToOne: false;
            referencedRelation: "tracked_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      microsoft_graph_tokens: {
        Row: {
          created_at: string | null;
          encrypted_token: string;
          expires_at: string;
          id: string;
          last_refreshed_at: string | null;
          scope: string | null;
          token_type: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          encrypted_token: string;
          expires_at: string;
          id?: string;
          last_refreshed_at?: string | null;
          scope?: string | null;
          token_type: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          encrypted_token?: string;
          expires_at?: string;
          id?: string;
          last_refreshed_at?: string | null;
          scope?: string | null;
          token_type?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      system_config: {
        Row: {
          description: string | null;
          id: string;
          key: string;
          updated_at: string | null;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          description?: string | null;
          id?: string;
          key: string;
          updated_at?: string | null;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "system_config_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "active_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_config_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tracked_emails: {
        Row: {
          bcc_emails: string[] | null;
          body_content: string | null;
          body_preview: string | null;
          bounce_count: number | null;
          bounce_detected_at: string | null;
          bounce_reason: string | null;
          bounce_type: string | null;
          cc_emails: string[] | null;
          conversation_id: string | null;
          conversation_index: string | null;
          created_at: string | null;
          followup_count: number | null;
          has_attachments: boolean | null;
          id: string;
          importance: string | null;
          in_reply_to: string | null;
          internet_message_id: string | null;
          is_reply: boolean | null;
          last_followup_sent_at: string | null;
          mailbox_id: string | null;
          microsoft_message_id: string;
          parent_message_id: string | null;
          recipient_emails: string[];
          references: string | null;
          requires_manual_review: boolean | null;
          responded_at: string | null;
          sender_email: string;
          sent_at: string;
          status: string;
          stopped_at: string | null;
          subject: string;
          thread_position: number | null;
          updated_at: string | null;
        };
        Insert: {
          bcc_emails?: string[] | null;
          body_content?: string | null;
          body_preview?: string | null;
          bounce_count?: number | null;
          bounce_detected_at?: string | null;
          bounce_reason?: string | null;
          bounce_type?: string | null;
          cc_emails?: string[] | null;
          conversation_id?: string | null;
          conversation_index?: string | null;
          created_at?: string | null;
          followup_count?: number | null;
          has_attachments?: boolean | null;
          id?: string;
          importance?: string | null;
          in_reply_to?: string | null;
          internet_message_id?: string | null;
          is_reply?: boolean | null;
          last_followup_sent_at?: string | null;
          mailbox_id?: string | null;
          microsoft_message_id: string;
          parent_message_id?: string | null;
          recipient_emails: string[];
          references?: string | null;
          requires_manual_review?: boolean | null;
          responded_at?: string | null;
          sender_email: string;
          sent_at: string;
          status?: string;
          stopped_at?: string | null;
          subject: string;
          thread_position?: number | null;
          updated_at?: string | null;
        };
        Update: {
          bcc_emails?: string[] | null;
          body_content?: string | null;
          body_preview?: string | null;
          bounce_count?: number | null;
          bounce_detected_at?: string | null;
          bounce_reason?: string | null;
          bounce_type?: string | null;
          cc_emails?: string[] | null;
          conversation_id?: string | null;
          conversation_index?: string | null;
          created_at?: string | null;
          followup_count?: number | null;
          has_attachments?: boolean | null;
          id?: string;
          importance?: string | null;
          in_reply_to?: string | null;
          internet_message_id?: string | null;
          is_reply?: boolean | null;
          last_followup_sent_at?: string | null;
          mailbox_id?: string | null;
          microsoft_message_id?: string;
          parent_message_id?: string | null;
          recipient_emails?: string[];
          references?: string | null;
          requires_manual_review?: boolean | null;
          responded_at?: string | null;
          sender_email?: string;
          sent_at?: string;
          status?: string;
          stopped_at?: string | null;
          subject?: string;
          thread_position?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tracked_emails_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_bounce_rates";
            referencedColumns: ["mailbox_id"];
          },
          {
            foreignKeyName: "tracked_emails_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_statistics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tracked_emails_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailboxes";
            referencedColumns: ["id"];
          },
        ];
      };
      user_mailbox_assignments: {
        Row: {
          assigned_at: string | null;
          assigned_by: string | null;
          id: string;
          mailbox_id: string | null;
          user_id: string | null;
        };
        Insert: {
          assigned_at?: string | null;
          assigned_by?: string | null;
          id?: string;
          mailbox_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          assigned_at?: string | null;
          assigned_by?: string | null;
          id?: string;
          mailbox_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_mailbox_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "active_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_mailbox_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_mailbox_assignments_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_bounce_rates";
            referencedColumns: ["mailbox_id"];
          },
          {
            foreignKeyName: "user_mailbox_assignments_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_statistics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_mailbox_assignments_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailboxes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_mailbox_assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_mailbox_assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          email: string;
          full_name: string | null;
          id: string;
          is_active: boolean;
          role: string;
          timezone: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          email: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          role: string;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          role?: string;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          change_type: string;
          client_state: string | null;
          id: string;
          processed: boolean | null;
          processed_at: string | null;
          processing_error: string | null;
          received_at: string | null;
          resource_data: Json;
          retry_count: number | null;
          subscription_id: string;
        };
        Insert: {
          change_type: string;
          client_state?: string | null;
          id?: string;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_error?: string | null;
          received_at?: string | null;
          resource_data: Json;
          retry_count?: number | null;
          subscription_id: string;
        };
        Update: {
          change_type?: string;
          client_state?: string | null;
          id?: string;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_error?: string | null;
          received_at?: string | null;
          resource_data?: Json;
          retry_count?: number | null;
          subscription_id?: string;
        };
        Relationships: [];
      };
      webhook_subscriptions: {
        Row: {
          change_type: string;
          created_at: string | null;
          expiration_date_time: string;
          id: string;
          include_resource_data: boolean | null;
          is_active: boolean | null;
          last_renewed_at: string | null;
          mailbox_id: string | null;
          notification_url: string;
          renewal_count: number | null;
          resource: string;
          subscription_id: string;
        };
        Insert: {
          change_type: string;
          created_at?: string | null;
          expiration_date_time: string;
          id?: string;
          include_resource_data?: boolean | null;
          is_active?: boolean | null;
          last_renewed_at?: string | null;
          mailbox_id?: string | null;
          notification_url: string;
          renewal_count?: number | null;
          resource: string;
          subscription_id: string;
        };
        Update: {
          change_type?: string;
          created_at?: string | null;
          expiration_date_time?: string;
          id?: string;
          include_resource_data?: boolean | null;
          is_active?: boolean | null;
          last_renewed_at?: string | null;
          mailbox_id?: string | null;
          notification_url?: string;
          renewal_count?: number | null;
          resource?: string;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_subscriptions_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_bounce_rates";
            referencedColumns: ["mailbox_id"];
          },
          {
            foreignKeyName: "webhook_subscriptions_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_statistics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_subscriptions_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailboxes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      active_users: {
        Row: {
          created_at: string | null;
          email: string | null;
          full_name: string | null;
          id: string | null;
          is_active: boolean | null;
          role: string | null;
          timezone: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string | null;
          is_active?: boolean | null;
          role?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string | null;
          is_active?: boolean | null;
          role?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      bounce_statistics: {
        Row: {
          bounce_category: string | null;
          bounce_codes: string[] | null;
          bounce_type: string | null;
          count: number | null;
          date: string | null;
          unique_emails: number | null;
        };
        Relationships: [];
      };
      emails_needing_followup: {
        Row: {
          bcc_emails: string[] | null;
          body_content: string | null;
          body_preview: string | null;
          cc_emails: string[] | null;
          conversation_id: string | null;
          created_at: string | null;
          has_attachments: boolean | null;
          id: string | null;
          importance: string | null;
          is_reply: boolean | null;
          last_followup_at: string | null;
          last_followup_number: number | null;
          mailbox_id: string | null;
          microsoft_message_id: string | null;
          parent_message_id: string | null;
          recipient_emails: string[] | null;
          responded_at: string | null;
          sender_email: string | null;
          sent_at: string | null;
          status: string | null;
          stopped_at: string | null;
          subject: string | null;
          thread_position: number | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tracked_emails_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_bounce_rates";
            referencedColumns: ["mailbox_id"];
          },
          {
            foreignKeyName: "tracked_emails_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_statistics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tracked_emails_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailboxes";
            referencedColumns: ["id"];
          },
        ];
      };
      emails_requiring_manual_handling: {
        Row: {
          days_since_last_followup: number | null;
          days_since_sent: number | null;
          followup_count: number | null;
          id: string | null;
          last_followup_sent_at: string | null;
          last_followup_subject: string | null;
          mailbox_email: string | null;
          mailbox_name: string | null;
          microsoft_message_id: string | null;
          next_possible_action_at: string | null;
          recipient_emails: string[] | null;
          requires_manual_review: boolean | null;
          sender_email: string | null;
          sent_at: string | null;
          status: string | null;
          subject: string | null;
          verified_sent_count: number | null;
        };
        Relationships: [];
      };
      followup_activity_summary: {
        Row: {
          automatic_followups: number | null;
          conversation_id: string | null;
          effective_status: string | null;
          followup_details: Json | null;
          id: string | null;
          last_activity_at: string | null;
          manual_followups: number | null;
          next_automatic_followup: string | null;
          next_followup_number: number | null;
          recipient_emails: string[] | null;
          sender_email: string | null;
          sent_at: string | null;
          status: string | null;
          subject: string | null;
          total_followups: number | null;
        };
        Relationships: [];
      };
      mailbox_bounce_rates: {
        Row: {
          bounce_rate_percent: number | null;
          bounced_emails: number | null;
          email_address: string | null;
          hard_bounces: number | null;
          health_status: string | null;
          mailbox_id: string | null;
          soft_bounces: number | null;
          total_emails: number | null;
        };
        Relationships: [];
      };
      mailbox_statistics: {
        Row: {
          email_address: string | null;
          id: string | null;
          pending_emails: number | null;
          responded_emails: number | null;
          response_rate: number | null;
          total_emails: number | null;
          total_followups_sent: number | null;
        };
        Relationships: [];
      };
      pending_response_detection: {
        Row: {
          bcc_emails: string[] | null;
          body_content: string | null;
          body_preview: string | null;
          cc_emails: string[] | null;
          conversation_id: string | null;
          conversation_index: string | null;
          created_at: string | null;
          has_attachments: boolean | null;
          id: string | null;
          importance: string | null;
          in_reply_to: string | null;
          internet_message_id: string | null;
          is_reply: boolean | null;
          mailbox_id: string | null;
          microsoft_message_id: string | null;
          parent_message_id: string | null;
          recipient_emails: string[] | null;
          references: string | null;
          responded_at: string | null;
          response_count: number | null;
          sender_email: string | null;
          sent_at: string | null;
          status: string | null;
          stopped_at: string | null;
          subject: string | null;
          thread_position: number | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tracked_emails_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_bounce_rates";
            referencedColumns: ["mailbox_id"];
          },
          {
            foreignKeyName: "tracked_emails_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailbox_statistics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tracked_emails_mailbox_id_fkey";
            columns: ["mailbox_id"];
            isOneToOne: false;
            referencedRelation: "mailboxes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      analyze_bounce_smtp_code: {
        Args: { p_smtp_code: string };
        Returns: {
          bounce_category: string;
          bounce_type: string;
          is_permanent: boolean;
          should_retry: boolean;
        }[];
      };
      can_access_followup: {
        Args: { tracked_email_id_param: string };
        Returns: boolean;
      };
      check_email_bounce_status: {
        Args: { p_tracked_email_id: string };
        Returns: {
          bounce_reason: string;
          bounce_type: string;
          can_retry: boolean;
          has_bounced: boolean;
          retry_count: number;
        }[];
      };
      clean_email_subject: {
        Args: { subject: string };
        Returns: string;
      };
      cleanup_old_deleted_users: {
        Args: { older_than_days?: number };
        Returns: number;
      };
      current_user_mailbox_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      disable_user_sync: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      enable_user_sync: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      get_emails_with_max_followups: {
        Args: { p_max_followups: number };
        Returns: {
          id: string;
        }[];
      };
      get_total_followup_count: {
        Args: { p_tracked_email_id: string };
        Returns: number;
      };
      hard_delete_user: {
        Args: { user_id: string };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_manager_or_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_user_deleted: {
        Args: { user_id: string };
        Returns: boolean;
      };
      mark_email_as_bounced: {
        Args: {
          p_bounce_reason: string;
          p_bounce_type: string;
          p_tracked_email_id: string;
        };
        Returns: undefined;
      };
      mark_email_manually_handled: {
        Args: { p_action?: string; p_email_id: string; p_reason?: string };
        Returns: boolean;
      };
      reschedule_pending_followups: {
        Args: {
          p_adjustment_hours?: number;
          p_base_time: string;
          p_tracked_email_id: string;
        };
        Returns: number;
      };
      restore_user: {
        Args: { user_id: string };
        Returns: boolean;
      };
      soft_delete_user: {
        Args: { user_id: string };
        Returns: boolean;
      };
      sync_all_users_from_auth: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
