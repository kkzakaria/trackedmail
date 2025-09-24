import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TablesInsert,
  TablesUpdate,
  Database,
} from "@/lib/types/database.types";
import { microsoftGraphService } from "./microsoft-graph.service";
import { webhookService } from "./webhook.service";
import type {
  ApiResponse,
  MailboxSyncResult,
  MailboxConfigurationResult,
  WebhookSubscriptionResult,
  WebhookStatusResult,
  WebhookRemovalResult,
} from "@/lib/types/microsoft-graph";

type MailboxInsert = TablesInsert<"mailboxes">;
type MailboxUpdate = TablesUpdate<"mailboxes">;

export class MailboxService {
  private supabase: SupabaseClient<Database> | null;

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || null;
  }

  private async getSupabase() {
    if (this.supabase) {
      return this.supabase;
    }
    return await createClient();
  }

  /**
   * Get all mailboxes with optional filters
   */
  async getMailboxes(filters?: {
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const supabase = await this.getSupabase();
    let query = supabase
      .from("mailboxes")
      .select("*, user_mailbox_assignments(count)", { count: "exact" })
      .order("email_address", { ascending: true });

    if (filters?.isActive !== undefined) {
      query = query.eq("is_active", filters.isActive);
    }

    if (filters?.search) {
      query = query.or(
        `email_address.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`
      );
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 10) - 1
      );
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { data, count };
  }

  /**
   * Get a single mailbox by ID
   */
  async getMailboxById(id: string) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("mailboxes")
      .select(
        `
        *,
        user_mailbox_assignments (
          id,
          user_id,
          assigned_at,
          assigned_by,
          users!user_mailbox_assignments_user_id_fkey (
            id,
            email,
            full_name,
            role
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get mailboxes by email address
   */
  async getMailboxByEmail(email: string) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("mailboxes")
      .select("*")
      .eq("email_address", email)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
    return data;
  }

  /**
   * Create a new mailbox
   */
  async createMailbox(mailbox: MailboxInsert) {
    // Check if mailbox already exists
    const existing = await this.getMailboxByEmail(mailbox.email_address);
    if (existing) {
      throw new Error("Une boîte mail avec cette adresse existe déjà");
    }

    // Résoudre l'email vers un ID Microsoft et récupérer les infos
    try {
      const userInfo = await microsoftGraphService.getUserByEmail(
        mailbox.email_address
      );

      if (!userInfo) {
        throw new Error(
          "L'adresse email n'existe pas dans le tenant Microsoft ou n'est pas accessible"
        );
      }

      // Préparer les données avec les infos Microsoft
      const mailboxData: MailboxInsert = {
        ...mailbox,
        microsoft_user_id: userInfo.id,
        // Utiliser le display_name fourni ou celui de Microsoft
        display_name:
          mailbox.display_name ||
          userInfo.displayName ||
          `${userInfo.givenName || ""} ${userInfo.surname || ""}`.trim() ||
          null,
        // S'assurer que l'email est correct (parfois mail != userPrincipalName)
        email_address:
          userInfo.mail || userInfo.userPrincipalName || mailbox.email_address,
      };

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from("mailboxes")
        .insert(mailboxData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      // Si c'est une erreur de Microsoft Graph, la propager
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "Erreur lors de la validation de l'email avec Microsoft Graph"
      );
    }
  }

  /**
   * Update a mailbox
   */
  async updateMailbox(id: string, updates: MailboxUpdate) {
    // If email is being updated, check for duplicates
    if (updates.email_address) {
      const existing = await this.getMailboxByEmail(updates.email_address);
      if (existing && existing.id !== id) {
        throw new Error("Une boîte mail avec cette adresse existe déjà");
      }
    }

    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("mailboxes")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a mailbox (cascade deletes assignments)
   */
  async deleteMailbox(id: string) {
    const supabase = await this.getSupabase();
    const { error } = await supabase.from("mailboxes").delete().eq("id", id);

    if (error) throw error;
  }

  /**
   * Toggle mailbox active status
   */
  async toggleMailboxStatus(id: string) {
    const mailbox = await this.getMailboxById(id);
    if (!mailbox) throw new Error("Boîte mail introuvable");

    return this.updateMailbox(id, {
      is_active: !mailbox.is_active,
    });
  }

  /**
   * Sync mailbox with Microsoft Graph
   */
  async syncWithMicrosoft(id: string): Promise<ApiResponse<MailboxSyncResult>> {
    try {
      // Récupérer la mailbox
      const mailbox = await this.getMailboxById(id);
      if (!mailbox) {
        return {
          success: false,
          error: "Mailbox not found",
          code: "MAILBOX_NOT_FOUND",
        };
      }

      if (!mailbox.microsoft_user_id) {
        return {
          success: false,
          error: "No Microsoft User ID configured for this mailbox",
          code: "NO_MICROSOFT_USER_ID",
        };
      }

      // Récupérer les informations utilisateur via Microsoft Graph
      const userInfo = await microsoftGraphService.getUser(
        mailbox.microsoft_user_id
      );

      // Mettre à jour les informations de la mailbox
      const updates: MailboxUpdate = {
        last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mettre à jour le nom d'affichage si différent
      if (
        userInfo.displayName &&
        userInfo.displayName !== mailbox.display_name
      ) {
        updates.display_name = userInfo.displayName;
      }

      // Mettre à jour l'email si différent
      if (userInfo.mail && userInfo.mail !== mailbox.email_address) {
        // Vérifier que le nouvel email n'est pas déjà utilisé
        const existing = await this.getMailboxByEmail(userInfo.mail);
        if (!existing) {
          updates.email_address = userInfo.mail;
        }
      }

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from("mailboxes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          mailbox: data,
          userInfo,
          updatedFields: Object.keys(updates),
        },
      };
    } catch (error) {
      console.error("Error syncing mailbox with Microsoft Graph:", error);
      return {
        success: false,
        error: "Failed to sync with Microsoft Graph",
        code: "SYNC_FAILED",
      };
    }
  }

  /**
   * Configure Microsoft Graph integration for a mailbox
   */
  async configureMicrosoftIntegration(
    id: string,
    microsoftUserId: string
  ): Promise<ApiResponse<MailboxConfigurationResult>> {
    try {
      // Vérifier que l'utilisateur Microsoft existe
      const userInfo = await microsoftGraphService.getUser(microsoftUserId);

      // Mettre à jour la mailbox avec l'ID utilisateur Microsoft
      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from("mailboxes")
        .update({
          microsoft_user_id: microsoftUserId,
          last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          mailbox: data,
          userInfo,
        },
      };
    } catch (error) {
      console.error("Error configuring Microsoft integration:", error);
      return {
        success: false,
        error: "Failed to configure Microsoft integration",
        code: "INTEGRATION_CONFIG_FAILED",
      };
    }
  }

  /**
   * Create webhook subscription for a mailbox
   */
  async createWebhookSubscription(
    id: string,
    options: {
      changeTypes?: string[];
      expirationHours?: number;
      includeResourceData?: boolean;
    } = {}
  ): Promise<ApiResponse<WebhookSubscriptionResult>> {
    try {
      const mailbox = await this.getMailboxById(id);
      if (!mailbox) {
        return {
          success: false,
          error: "Mailbox not found",
          code: "MAILBOX_NOT_FOUND",
        };
      }

      if (!mailbox.microsoft_user_id) {
        return {
          success: false,
          error: "No Microsoft User ID configured for this mailbox",
          code: "NO_MICROSOFT_USER_ID",
        };
      }

      // Créer l'abonnement webhook
      const result = await webhookService.createSubscription(
        id,
        mailbox.microsoft_user_id,
        options
      );

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            subscription: result.data,
            created: true,
          },
        };
      }

      return {
        success: false,
        error: result.error ?? "Unknown error",
        code: result.code ?? "UNKNOWN_ERROR",
      };
    } catch (error) {
      console.error("Error creating webhook subscription:", error);
      return {
        success: false,
        error: "Failed to create webhook subscription",
        code: "WEBHOOK_CREATION_FAILED",
      };
    }
  }

  /**
   * Get webhook subscription status for a mailbox
   */
  async getWebhookSubscriptionStatus(
    id: string
  ): Promise<ApiResponse<WebhookStatusResult>> {
    try {
      const result = await webhookService.getActiveSubscription(id);

      if (result.success && result.data) {
        // Determine health status
        const now = new Date();
        const expiresAt = new Date(result.data.expiresAt);
        const hoursUntilExpiry =
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        let health: "healthy" | "expiring" | "expired" | "error" = "healthy";
        if (hoursUntilExpiry <= 0) {
          health = "expired";
        } else if (hoursUntilExpiry <= 24) {
          health = "expiring";
        }

        return {
          success: true,
          data: {
            hasActiveSubscription: result.data.isActive,
            subscription: result.data,
            health,
          },
        };
      }

      return {
        success: true,
        data: {
          hasActiveSubscription: false,
          health: "error" as const,
        },
      };
    } catch (error) {
      console.error("Error getting webhook subscription status:", error);
      return {
        success: false,
        error: "Failed to get webhook subscription status",
        code: "WEBHOOK_STATUS_FAILED",
      };
    }
  }

  /**
   * Remove webhook subscription for a mailbox
   */
  async removeWebhookSubscription(
    id: string
  ): Promise<ApiResponse<WebhookRemovalResult>> {
    try {
      // Récupérer l'abonnement actif
      const activeSubscription = await webhookService.getActiveSubscription(id);

      if (!activeSubscription.success || !activeSubscription.data) {
        return {
          success: true,
          data: {
            deleted: false,
          },
        };
      }

      // Supprimer l'abonnement
      const result = await webhookService.deleteSubscription(
        activeSubscription.data.id
      );

      if (result.success) {
        return {
          success: true,
          data: {
            deleted: true,
            subscriptionId: activeSubscription.data.id,
          },
        };
      }

      return {
        success: false,
        error: result.error ?? "Unknown error",
        code: result.code ?? "UNKNOWN_ERROR",
      };
    } catch (error) {
      console.error("Error removing webhook subscription:", error);
      return {
        success: false,
        error: "Failed to remove webhook subscription",
        code: "WEBHOOK_REMOVAL_FAILED",
      };
    }
  }

  /**
   * Get mailbox statistics
   */
  async getMailboxStatistics(id: string) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("mailbox_statistics")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  /**
   * Get user's assigned mailboxes
   */
  async getUserMailboxes(userId: string) {
    const supabase = await this.getSupabase();
    const { data: user, error: userError } = await supabase
      .from("active_users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError) throw userError;

    // Managers and admins can see all mailboxes
    if (user.role === "manager" || user.role === "administrateur") {
      const { data, error } = await supabase
        .from("mailboxes")
        .select("*")
        .order("email_address");

      if (error) throw error;
      return data;
    }

    // Regular users only see assigned mailboxes
    const { data, error } = await supabase
      .from("user_mailbox_assignments")
      .select(
        `
        mailbox_id,
        mailboxes (*)
      `
      )
      .eq("user_id", userId);

    if (error) throw error;
    return data?.map(assignment => assignment.mailboxes).filter(Boolean) || [];
  }
}
