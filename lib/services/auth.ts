import { createServerComponentClient } from "@/lib/supabase/client";
import type { UserInsert, UserUpdate } from "@/lib/types";

export class AuthService {
  /**
   * Get current user from server-side
   */
  static async getCurrentUser() {
    const supabase = await createServerComponentClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    return profile;
  }

  /**
   * Check if user has required role
   */
  static async hasRole(userId: string, requiredRoles: string[]) {
    const supabase = await createServerComponentClient();

    const { data: user, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }

  /**
   * Check if user is admin
   */
  static async isAdmin(userId: string) {
    return this.hasRole(userId, ["administrateur"]);
  }

  /**
   * Check if user is manager or admin
   */
  static async isManagerOrAdmin(userId: string) {
    return this.hasRole(userId, ["manager", "administrateur"]);
  }

  /**
   * Get user's assigned mailboxes
   */
  static async getUserMailboxes(userId: string) {
    const supabase = await createServerComponentClient();

    const { data, error } = await supabase
      .from("user_mailbox_assignments")
      .select(
        `
        mailbox:mailboxes (
          id,
          email_address,
          display_name,
          is_active,
          last_sync
        )
      `
      )
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return data?.map(item => item.mailbox).filter(Boolean) || [];
  }

  /**
   * Create user profile after signup
   */
  static async createUserProfile(userData: UserInsert) {
    const supabase = await createServerComponentClient();

    const { data, error } = await supabase
      .from("users")
      .insert(userData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId: string, updates: UserUpdate) {
    const supabase = await createServerComponentClient();

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}
