import { createClient } from "@/lib/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/lib/types/database.types";

type MailboxInsert = TablesInsert<"mailboxes">;
type MailboxUpdate = TablesUpdate<"mailboxes">;

export class MailboxService {
  private supabase = createClient();

  /**
   * Get all mailboxes with optional filters
   */
  async getMailboxes(filters?: {
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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

    const { data, error } = await this.supabase
      .from("mailboxes")
      .insert(mailbox)
      .select()
      .single();

    if (error) throw error;
    return data;
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

    const { data, error } = await this.supabase
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
    const { error } = await this.supabase
      .from("mailboxes")
      .delete()
      .eq("id", id);

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
   * Sync mailbox with Microsoft Graph (placeholder for future)
   */
  async syncWithMicrosoft(id: string) {
    // TODO: Implement Microsoft Graph sync in Phase 2.2
    const { data, error } = await this.supabase
      .from("mailboxes")
      .update({
        last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get mailbox statistics
   */
  async getMailboxStatistics(id: string) {
    const { data, error } = await this.supabase
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
    const { data: user, error: userError } = await this.supabase
      .from("active_users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError) throw userError;

    // Managers and admins can see all mailboxes
    if (user.role === "manager" || user.role === "administrateur") {
      const { data, error } = await this.supabase
        .from("mailboxes")
        .select("*")
        .order("email_address");

      if (error) throw error;
      return data;
    }

    // Regular users only see assigned mailboxes
    const { data, error } = await this.supabase
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
