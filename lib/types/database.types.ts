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
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      email_responses: {
        Row: {
          body_preview: string | null;
          created_at: string | null;
          id: string;
          is_auto_response: boolean | null;
          microsoft_message_id: string;
          received_at: string;
          response_type: string | null;
          sender_email: string;
          subject: string | null;
          tracked_email_id: string | null;
        };
        Insert: {
          body_preview?: string | null;
          created_at?: string | null;
          id?: string;
          is_auto_response?: boolean | null;
          microsoft_message_id: string;
          received_at: string;
          response_type?: string | null;
          sender_email: string;
          subject?: string | null;
          tracked_email_id?: string | null;
        };
        Update: {
          body_preview?: string | null;
          created_at?: string | null;
          id?: string;
          is_auto_response?: boolean | null;
          microsoft_message_id?: string;
          received_at?: string;
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
          updated_at?: string | null;
        };
        Relationships: [];
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
          cc_emails: string[] | null;
          conversation_id: string | null;
          created_at: string | null;
          has_attachments: boolean | null;
          id: string;
          importance: string | null;
          is_reply: boolean | null;
          mailbox_id: string | null;
          microsoft_message_id: string;
          parent_message_id: string | null;
          recipient_emails: string[];
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
          cc_emails?: string[] | null;
          conversation_id?: string | null;
          created_at?: string | null;
          has_attachments?: boolean | null;
          id?: string;
          importance?: string | null;
          is_reply?: boolean | null;
          mailbox_id?: string | null;
          microsoft_message_id: string;
          parent_message_id?: string | null;
          recipient_emails: string[];
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
          cc_emails?: string[] | null;
          conversation_id?: string | null;
          created_at?: string | null;
          has_attachments?: boolean | null;
          id?: string;
          importance?: string | null;
          is_reply?: boolean | null;
          mailbox_id?: string | null;
          microsoft_message_id?: string;
          parent_message_id?: string | null;
          recipient_emails?: string[];
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
            referencedRelation: "users";
            referencedColumns: ["id"];
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
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string | null;
          email: string;
          full_name: string | null;
          id: string;
          mailbox_address: string | null;
          pause_relances: boolean | null;
          role: string;
          timezone: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          full_name?: string | null;
          id?: string;
          mailbox_address?: string | null;
          pause_relances?: boolean | null;
          role: string;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          mailbox_address?: string | null;
          pause_relances?: boolean | null;
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
    };
    Views: {
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
    };
    Functions: {
      [_ in never]: never;
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
