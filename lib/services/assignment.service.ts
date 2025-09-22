import { createClient } from '@/lib/supabase/client';
import type { TablesInsert } from '@/lib/types/database.types';

type AssignmentInsert = TablesInsert<'user_mailbox_assignments'>;

export class AssignmentService {
  private supabase = createClient();

  /**
   * Get all mailboxes assigned to a user
   */
  async getUserMailboxes(userId: string) {
    const { data, error } = await this.supabase
      .from('user_mailbox_assignments')
      .select(`
        id,
        assigned_at,
        assigned_by,
        mailbox_id,
        mailboxes (
          id,
          email_address,
          display_name,
          is_active,
          last_sync
        )
      `)
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Get all users assigned to a mailbox
   */
  async getMailboxUsers(mailboxId: string) {
    const { data, error } = await this.supabase
      .from('user_mailbox_assignments')
      .select(`
        id,
        assigned_at,
        user_id,
        users!user_mailbox_assignments_user_id_fkey (
          id,
          email,
          full_name,
          role
        ),
        assigned_by_user:users!user_mailbox_assignments_assigned_by_fkey (
          email,
          full_name
        )
      `)
      .eq('mailbox_id', mailboxId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Check if user is assigned to mailbox
   */
  async isUserAssigned(userId: string, mailboxId: string) {
    const { data, error } = await this.supabase
      .from('user_mailbox_assignments')
      .select('id')
      .eq('user_id', userId)
      .eq('mailbox_id', mailboxId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  /**
   * Assign a mailbox to a user
   */
  async assignMailbox(assignment: {
    userId: string;
    mailboxId: string;
    assignedBy: string;
  }) {
    // Check if already assigned
    const isAssigned = await this.isUserAssigned(assignment.userId, assignment.mailboxId);
    if (isAssigned) {
      throw new Error('Cet utilisateur est déjà assigné à cette boîte mail');
    }

    const { data, error } = await this.supabase
      .from('user_mailbox_assignments')
      .insert({
        user_id: assignment.userId,
        mailbox_id: assignment.mailboxId,
        assigned_by: assignment.assignedBy,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Remove mailbox assignment from user
   */
  async unassignMailbox(userId: string, mailboxId: string) {
    const { error } = await this.supabase
      .from('user_mailbox_assignments')
      .delete()
      .eq('user_id', userId)
      .eq('mailbox_id', mailboxId);

    if (error) throw error;
  }

  /**
   * Bulk assign multiple mailboxes to a user
   */
  async bulkAssignToUser(userId: string, mailboxIds: string[], assignedBy: string) {
    // Get existing assignments
    const { data: existing, error: existingError } = await this.supabase
      .from('user_mailbox_assignments')
      .select('mailbox_id')
      .eq('user_id', userId);

    if (existingError) throw existingError;

    const existingMailboxIds = existing?.map(a => a.mailbox_id) || [];
    const newMailboxIds = mailboxIds.filter(id => !existingMailboxIds.includes(id));

    if (newMailboxIds.length === 0) {
      return { added: 0, skipped: mailboxIds.length };
    }

    const assignments: AssignmentInsert[] = newMailboxIds.map(mailboxId => ({
      user_id: userId,
      mailbox_id: mailboxId,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString()
    }));

    const { data, error } = await this.supabase
      .from('user_mailbox_assignments')
      .insert(assignments)
      .select();

    if (error) throw error;
    return {
      added: data?.length || 0,
      skipped: existingMailboxIds.length
    };
  }

  /**
   * Bulk assign multiple users to a mailbox
   */
  async bulkAssignToMailbox(mailboxId: string, userIds: string[], assignedBy: string) {
    // Get existing assignments
    const { data: existing, error: existingError } = await this.supabase
      .from('user_mailbox_assignments')
      .select('user_id')
      .eq('mailbox_id', mailboxId);

    if (existingError) throw existingError;

    const existingUserIds = existing?.map(a => a.user_id) || [];
    const newUserIds = userIds.filter(id => !existingUserIds.includes(id));

    if (newUserIds.length === 0) {
      return { added: 0, skipped: userIds.length };
    }

    const assignments: AssignmentInsert[] = newUserIds.map(userId => ({
      user_id: userId,
      mailbox_id: mailboxId,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString()
    }));

    const { data, error } = await this.supabase
      .from('user_mailbox_assignments')
      .insert(assignments)
      .select();

    if (error) throw error;
    return {
      added: data?.length || 0,
      skipped: existingUserIds.length
    };
  }

  /**
   * Remove all mailbox assignments for a user
   */
  async removeAllUserAssignments(userId: string) {
    const { error } = await this.supabase
      .from('user_mailbox_assignments')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Remove all user assignments for a mailbox
   */
  async removeAllMailboxAssignments(mailboxId: string) {
    const { error } = await this.supabase
      .from('user_mailbox_assignments')
      .delete()
      .eq('mailbox_id', mailboxId);

    if (error) throw error;
  }

  /**
   * Get assignment statistics
   */
  async getAssignmentStats() {
    const { data: mailboxCount, error: mailboxError } = await this.supabase
      .from('mailboxes')
      .select('*', { count: 'exact', head: true });

    const { data: userCount, error: userError } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { data: assignmentCount, error: assignmentError } = await this.supabase
      .from('user_mailbox_assignments')
      .select('*', { count: 'exact', head: true });

    if (mailboxError || userError || assignmentError) {
      throw mailboxError || userError || assignmentError;
    }

    return {
      totalMailboxes: mailboxCount,
      totalUsers: userCount,
      totalAssignments: assignmentCount
    };
  }
}