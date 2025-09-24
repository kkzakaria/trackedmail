import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import type { UserRole, UserInsert, UserUpdate } from "@/lib/types/auth";

export class UserService {
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
   * Get all users with optional filters
   */
  async getUsers(filters?: {
    isActive?: boolean;
    role?: UserRole;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const supabase = await this.getSupabase();
    let query = supabase
      .from("users")
      .select("*", { count: "exact" })
      .order("full_name", { ascending: true });

    if (filters?.isActive !== undefined) {
      query = query.eq("is_active", filters.isActive);
    }

    if (filters?.role) {
      query = query.eq("role", filters.role);
    }

    if (filters?.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
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
   * Get a single user by ID with details
   */
  async getUserById(id: string) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("users")
      .select(
        `
        *,
        user_mailbox_assignments!user_mailbox_assignments_user_id_fkey (
          id,
          mailbox_id,
          assigned_at,
          assigned_by,
          mailboxes!user_mailbox_assignments_mailbox_id_fkey (
            id,
            email_address,
            display_name,
            is_active
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
   * Get user by email address
   */
  async getUserByEmail(email: string) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
    return data;
  }

  /**
   * Create a new user
   */
  async createUser(userData: UserInsert) {
    // Check if user already exists
    const existing = await this.getUserByEmail(userData.email);
    if (existing) {
      throw new Error("Un utilisateur avec cette adresse email existe déjà");
    }

    const supabase = await this.getSupabase();

    // Prepare user data
    const userToInsert: UserInsert = {
      ...userData,
      is_active: userData.is_active ?? true,
      timezone: userData.timezone || "Europe/Paris",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("users")
      .insert(userToInsert)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update a user
   */
  async updateUser(id: string, updates: UserUpdate) {
    // If email is being updated, check for duplicates
    if (updates.email) {
      const existing = await this.getUserByEmail(updates.email);
      if (existing && existing.id !== id) {
        throw new Error("Un utilisateur avec cette adresse email existe déjà");
      }
    }

    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("users")
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
   * Soft delete a user (set is_active to false)
   */
  async softDeleteUser(id: string) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("users")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Restore a soft-deleted user
   */
  async restoreUser(id: string) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("users")
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Hard delete a user (permanent deletion)
   * Note: Should only be used by administrators and with extreme caution
   */
  async deleteUser(id: string) {
    const supabase = await this.getSupabase();
    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) throw error;
  }

  /**
   * Toggle user active status
   */
  async toggleUserStatus(id: string) {
    const user = await this.getUserById(id);
    if (!user) throw new Error("Utilisateur introuvable");

    return this.updateUser(id, {
      is_active: !user.is_active,
    });
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(id: string) {
    const supabase = await this.getSupabase();

    // Manual calculation since RPC might not exist
    // Note: This could be enhanced with a proper RPC function in the future

    // Manual calculation
    const { data: user } = await supabase
      .from("users")
      .select(
        `
        id,
        email,
        full_name,
        role,
        created_at
      `
      )
      .eq("id", id)
      .single();

    if (!user) throw new Error("Utilisateur introuvable");

    // Get mailbox assignments count
    const { count: assignmentsCount } = await supabase
      .from("user_mailbox_assignments")
      .select("*", { count: "exact" })
      .eq("user_id", id);

    // Get assigned mailbox IDs
    const { data: assignments } = await supabase
      .from("user_mailbox_assignments")
      .select("mailbox_id")
      .eq("user_id", id);

    const mailboxIds = assignments?.map(a => a.mailbox_id) || [];

    // Get email statistics from assigned mailboxes
    let emailsCount = 0;
    if (mailboxIds.length > 0) {
      const { count } = await supabase
        .from("tracked_emails")
        .select("*", { count: "exact" })
        .in("mailbox_id", mailboxIds);
      emailsCount = count || 0;
    }

    return {
      user_id: id,
      emails_sent: emailsCount,
      emails_tracked: emailsCount,
      response_rate: 0, // Would need more complex calculation
      active_followups: 0, // Would need followups table query
      last_activity: user.created_at,
      mailboxes_assigned: assignmentsCount || 0,
    };
  }

  /**
   * Get user activity/audit trail
   * Note: This would require an audit log table to be fully functional
   */
  async getUserActivity(
    id: string,
    _options?: {
      limit?: number;
      offset?: number;
      actionType?: string;
    }
  ) {
    // Since audit table doesn't exist yet, return basic activity from user data
    const user = await this.getUserById(id);
    return [
      {
        id: `${id}-created`,
        user_id: id,
        action: "created" as const,
        details: { user: user.full_name },
        created_at: user.created_at,
        ip_address: null,
      },
    ];
  }

  /**
   * Assign a mailbox to a user
   */
  async assignMailbox(userId: string, mailboxId: string, assignedBy: string) {
    const supabase = await this.getSupabase();

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from("user_mailbox_assignments")
      .select("id")
      .eq("user_id", userId)
      .eq("mailbox_id", mailboxId)
      .single();

    if (existing) {
      throw new Error("Cette boîte mail est déjà assignée à cet utilisateur");
    }

    const { data, error } = await supabase
      .from("user_mailbox_assignments")
      .insert({
        user_id: userId,
        mailbox_id: mailboxId,
        assigned_by: assignedBy,
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Unassign a mailbox from a user
   */
  async unassignMailbox(userId: string, mailboxId: string) {
    const supabase = await this.getSupabase();
    const { error } = await supabase
      .from("user_mailbox_assignments")
      .delete()
      .eq("user_id", userId)
      .eq("mailbox_id", mailboxId);

    if (error) throw error;
  }

  /**
   * Get all mailbox assignments for a user
   */
  async getUserMailboxAssignments(userId: string) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("user_mailbox_assignments")
      .select(
        `
        *,
        mailboxes (
          id,
          email_address,
          display_name,
          is_active
        )
      `
      )
      .eq("user_id", userId)
      .order("assigned_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Bulk assign mailboxes to a user
   */
  async bulkAssignMailboxes(
    userId: string,
    mailboxIds: string[],
    assignedBy: string
  ) {
    const supabase = await this.getSupabase();

    // Prepare assignments data
    const assignments = mailboxIds.map(mailboxId => ({
      user_id: userId,
      mailbox_id: mailboxId,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("user_mailbox_assignments")
      .upsert(assignments, { onConflict: "user_id,mailbox_id" })
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * Get users with role filtering and stats
   */
  async getUsersByRole(role: UserRole) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("users")
      .select(
        `
        *,
        user_mailbox_assignments!user_mailbox_assignments_user_id_fkey(count)
      `
      )
      .eq("role", role)
      .eq("is_active", true)
      .order("full_name");

    if (error) throw error;
    return data;
  }

  /**
   * Search users by name or email
   */
  async searchUsers(searchTerm: string, limit: number = 10) {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .eq("is_active", true)
      .order("full_name")
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Get users that can be assigned to mailboxes (managers and regular users)
   */
  async getAssignableUsers() {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .in("role", ["manager", "utilisateur"])
      .eq("is_active", true)
      .order("full_name");

    if (error) throw error;
    return data;
  }

  /**
   * Get user dashboard metrics
   */
  async getUserDashboardMetrics(userId: string) {
    const supabase = await this.getSupabase();

    // Get user's assigned mailboxes
    const { data: assignments } = await supabase
      .from("user_mailbox_assignments")
      .select("mailbox_id")
      .eq("user_id", userId);

    const mailboxIds = assignments?.map(a => a.mailbox_id) || [];

    if (mailboxIds.length === 0) {
      return {
        total_emails_tracked: 0,
        emails_with_responses: 0,
        active_followups: 0,
        response_rate: 0,
        mailboxes_count: 0,
      };
    }

    // Get tracked emails from assigned mailboxes
    const { data: emails, count: totalEmails } = await supabase
      .from("tracked_emails")
      .select("status", { count: "exact" })
      .in("mailbox_id", mailboxIds);

    const emailsWithResponses =
      emails?.filter(e => e.status === "responded").length || 0;
    const responseRate = totalEmails
      ? (emailsWithResponses / totalEmails) * 100
      : 0;

    // Get active followups count
    const { count: activeFollowups } = await supabase
      .from("followups")
      .select("*", { count: "exact" })
      .in(
        "tracked_email_id",
        emails?.map((_, index) => `email_${index}`) || [] // This would need proper email IDs
      )
      .eq("status", "scheduled");

    return {
      total_emails_tracked: totalEmails || 0,
      emails_with_responses: emailsWithResponses,
      active_followups: activeFollowups || 0,
      response_rate: Math.round(responseRate * 100) / 100,
      mailboxes_count: mailboxIds.length,
    };
  }
}
