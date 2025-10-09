import { createClient } from "@/lib/supabase/client";
import type {
  TrackedEmailWithDetails,
  EmailStatus,
  EmailImportance,
} from "@/lib/types";

const supabase = createClient();

// Type pour les mises à jour
type EmailUpdateData = {
  status: EmailStatus;
  stopped_at?: string;
};

export interface TrackedEmailFilters {
  search?: string;
  status?: EmailStatus[];
  mailboxId?: string;
  dateFrom?: string;
  dateTo?: string;
  minFollowups?: number;
  maxFollowups?: number;
}

export interface TrackedEmailListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: TrackedEmailFilters;
}

export class TrackedEmailService {
  /**
   * Get tracked emails with enriched data and filtering
   */
  static async getTrackedEmails(options: TrackedEmailListOptions = {}) {
    const {
      page = 0,
      pageSize = 10,
      sortBy = "sent_at",
      sortOrder = "desc",
      filters = {},
    } = options;

    // Build the base query with joins
    let query = supabase.from("tracked_emails").select(
      `
        *,
        mailbox:mailboxes(
          id,
          email_address,
          display_name
        )
        `,
      { count: "exact" }
    );

    // Apply filters
    if (filters.search) {
      // Use PostgreSQL Full Text Search (bilingual: English + French)
      // Searches across: subject, body_preview, body_content, sender_email, recipient_emails, cc_emails
      // Search in both English and French FTS columns with OR logic
      // PostgREST syntax: column.fts(config).query or column.wfts.query (websearch)
      query = query.or(
        `fts_en.wfts.${filters.search},fts_fr.wfts(french).${filters.search}`
      );
    }

    if (filters.status?.length) {
      query = query.in("status", filters.status);
    }

    if (filters.mailboxId) {
      query = query.eq("mailbox_id", filters.mailboxId);
    }

    if (filters.dateFrom) {
      query = query.gte("sent_at", filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte("sent_at", filters.dateTo);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Apply pagination
    const start = page * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data: rawEmails, error, count } = await query;

    if (error) {
      console.error("[TrackedEmailService] Query error:", error);
      throw new Error(`Failed to fetch tracked emails: ${error.message}`);
    }

    if (!rawEmails || rawEmails.length === 0) {
      return {
        data: [],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    }

    // ✅ OPTIMIZATION: Batch fetch all related data instead of N+1 queries
    const emailIds = rawEmails.map(e => e.id);

    // Fetch all response counts in one query
    const { data: responses } = await supabase
      .from("email_responses")
      .select("tracked_email_id")
      .in("tracked_email_id", emailIds)
      .eq("is_auto_response", false);

    // Count responses per email
    const responseCounts = (responses || []).reduce(
      (acc, r) => {
        if (r.tracked_email_id) {
          acc[r.tracked_email_id] = (acc[r.tracked_email_id] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    // Fetch all followups in one query
    const { data: followups } = await supabase
      .from("followups")
      .select("tracked_email_id, sent_at")
      .in("tracked_email_id", emailIds)
      .eq("status", "sent")
      .order("sent_at", { ascending: false });

    // Group followups per email
    const followupsByEmail: Record<string, Array<{ sent_at: string }>> = {};
    (followups || []).forEach(f => {
      const emailId = f.tracked_email_id;
      const sentAt = f.sent_at;

      if (emailId && sentAt) {
        if (!followupsByEmail[emailId]) {
          followupsByEmail[emailId] = [];
        }
        followupsByEmail[emailId].push({ sent_at: sentAt });
      }
    });

    // Enrich emails with the batched data (no more async calls!)
    const enrichedEmails = rawEmails.map(email => {
      const emailFollowups = followupsByEmail[email.id] || [];
      const followupCount = emailFollowups.length;
      const lastFollowupSent = emailFollowups[0]?.sent_at || null;
      const responseCount = responseCounts[email.id] || 0;

      // Calculate days since sent
      const sentDate = new Date(email.sent_at);
      const now = new Date();
      const daysSinceSent = Math.floor(
        (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: email.id,
        microsoft_message_id: email.microsoft_message_id,
        conversation_id: email.conversation_id,
        subject: email.subject,
        sender_email: email.sender_email,
        recipient_emails: email.recipient_emails,
        cc_emails: email.cc_emails,
        bcc_emails: email.bcc_emails,
        body_preview: email.body_preview,
        status: email.status as EmailStatus,
        sent_at: email.sent_at,
        responded_at: email.responded_at,
        stopped_at: email.stopped_at,
        has_attachments: email.has_attachments,
        importance: email.importance as EmailImportance | null,
        mailbox: email.mailbox,
        response_count: responseCount,
        followup_count: followupCount,
        last_followup_sent: lastFollowupSent,
        days_since_sent: daysSinceSent,
        requires_manual_review: email.requires_manual_review || false,
        last_followup_sent_at: email.last_followup_sent_at,
      };
    });

    return {
      data: enrichedEmails,
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * Get status counts for dashboard metrics
   */
  static async getStatusCounts() {
    const { data, error } = await supabase
      .from("tracked_emails")
      .select("status")
      .then(async result => {
        if (result.error) throw result.error;

        const counts = result.data.reduce(
          (acc: Record<string, number>, email: { status: string }) => {
            acc[email.status] = (acc[email.status] || 0) + 1;
            return acc;
          },
          {}
        );

        return { data: counts, error: null };
      });

    if (error) {
      throw new Error(`Failed to fetch status counts: ${error}`);
    }

    return data;
  }

  /**
   * Update email status (stop tracking, resume, etc.)
   */
  static async updateEmailStatus(emailId: string, status: EmailStatus) {
    const updateData: EmailUpdateData = { status };

    if (status === "stopped") {
      updateData.stopped_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("tracked_emails")
      .update(updateData)
      .eq("id", emailId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update email status: ${error.message}`);
    }

    return data;
  }

  /**
   * Bulk update email statuses
   */
  static async bulkUpdateStatus(emailIds: string[], status: EmailStatus) {
    const updateData: EmailUpdateData = { status };

    if (status === "stopped") {
      updateData.stopped_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("tracked_emails")
      .update(updateData)
      .in("id", emailIds)
      .select();

    if (error) {
      throw new Error(`Failed to bulk update email status: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a tracked email (admin only)
   */
  static async deleteTrackedEmail(emailId: string): Promise<void> {
    const { error } = await supabase
      .from("tracked_emails")
      .delete()
      .eq("id", emailId);

    if (error) {
      throw new Error(`Failed to delete tracked email: ${error.message}`);
    }
  }

  /**
   * Bulk delete tracked emails (admin only)
   */
  static async bulkDeleteEmails(emailIds: string[]): Promise<{
    deleted: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let deleted = 0;

    // Process deletions in parallel for better performance
    const deletionPromises = emailIds.map(async emailId => {
      try {
        await this.deleteTrackedEmail(emailId);
        deleted++;
      } catch (error) {
        errors.push(
          `Failed to delete email ${emailId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    });

    await Promise.all(deletionPromises);

    return { deleted, errors };
  }

  /**
   * Get tracked email details with full relations
   */
  static async getTrackedEmailById(
    id: string
  ): Promise<TrackedEmailWithDetails | null> {
    const { data, error } = await supabase
      .from("tracked_emails")
      .select(
        `
        *,
        mailbox:mailboxes(
          id,
          email_address,
          display_name
        ),
        email_responses(
          id,
          sender_email,
          subject,
          received_at,
          response_type,
          is_auto_response
        ),
        followups(
          id,
          followup_number,
          status,
          scheduled_for,
          sent_at,
          subject
        )
        `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Failed to fetch tracked email: ${error.message}`);
    }

    // 🚀 OPTIMIZATION: Calculate stats directly from joined relations
    // Avoids N+1 queries from deprecated enrichTrackedEmail function
    const responses =
      (data.email_responses as Array<{ is_auto_response: boolean }>) || [];
    const followups =
      (data.followups as Array<{ sent_at: string; status: string }>) || [];

    const responseCount = responses.filter(r => !r.is_auto_response).length;
    const sentFollowups = followups.filter(f => f.status === "sent");
    const followupCount = sentFollowups.length;
    const lastFollowupSent =
      sentFollowups.length > 0
        ? sentFollowups.sort(
            (a, b) =>
              new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
          )[0]?.sent_at || null
        : null;

    // Calculate days since sent
    const sentDate = new Date(data.sent_at);
    const now = new Date();
    const daysSinceSent = Math.floor(
      (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: data.id,
      microsoft_message_id: data.microsoft_message_id,
      conversation_id: data.conversation_id,
      subject: data.subject,
      sender_email: data.sender_email,
      recipient_emails: data.recipient_emails,
      cc_emails: data.cc_emails,
      bcc_emails: data.bcc_emails,
      body_preview: data.body_preview,
      status: data.status as EmailStatus,
      sent_at: data.sent_at,
      responded_at: data.responded_at,
      stopped_at: data.stopped_at,
      has_attachments: data.has_attachments,
      importance: data.importance as EmailImportance | null,
      mailbox: data.mailbox,
      response_count: responseCount,
      followup_count: followupCount,
      last_followup_sent: lastFollowupSent,
      days_since_sent: daysSinceSent,
      requires_manual_review: data.requires_manual_review || false,
      last_followup_sent_at: data.last_followup_sent_at,
    };
  }

  /**
   * 🚀 OPTIMIZATION: Get multiple tracked emails by IDs with single batch query
   * Replaces N individual queries with 1 batch query
   */
  static async getBatchTrackedEmailsByIds(
    ids: string[]
  ): Promise<TrackedEmailWithDetails[]> {
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("tracked_emails")
      .select(
        `
        *,
        mailbox:mailboxes(
          id,
          email_address,
          display_name
        ),
        email_responses(
          id,
          sender_email,
          subject,
          received_at,
          response_type,
          is_auto_response
        ),
        followups(
          id,
          followup_number,
          status,
          scheduled_for,
          sent_at,
          subject
        )
        `
      )
      .in("id", ids);

    if (error) {
      throw new Error(`Failed to fetch batch tracked emails: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    // Process all emails in batch
    return data.map(emailData => {
      const responses =
        (emailData.email_responses as Array<{ is_auto_response: boolean }>) ||
        [];
      const followups =
        (emailData.followups as Array<{ sent_at: string; status: string }>) ||
        [];

      const responseCount = responses.filter(r => !r.is_auto_response).length;
      const sentFollowups = followups.filter(f => f.status === "sent");
      const followupCount = sentFollowups.length;
      const lastFollowupSent =
        sentFollowups.length > 0
          ? sentFollowups.sort(
              (a, b) =>
                new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
            )[0]?.sent_at || null
          : null;

      // Calculate days since sent
      const sentDate = new Date(emailData.sent_at);
      const now = new Date();
      const daysSinceSent = Math.floor(
        (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: emailData.id,
        microsoft_message_id: emailData.microsoft_message_id,
        conversation_id: emailData.conversation_id,
        subject: emailData.subject,
        sender_email: emailData.sender_email,
        recipient_emails: emailData.recipient_emails,
        cc_emails: emailData.cc_emails,
        bcc_emails: emailData.bcc_emails,
        body_preview: emailData.body_preview,
        status: emailData.status as EmailStatus,
        sent_at: emailData.sent_at,
        responded_at: emailData.responded_at,
        stopped_at: emailData.stopped_at,
        has_attachments: emailData.has_attachments,
        importance: emailData.importance as EmailImportance | null,
        mailbox: emailData.mailbox,
        response_count: responseCount,
        followup_count: followupCount,
        last_followup_sent: lastFollowupSent,
        days_since_sent: daysSinceSent,
        requires_manual_review: emailData.requires_manual_review || false,
        last_followup_sent_at: emailData.last_followup_sent_at,
      };
    });
  }

  /**
   * Subscribe to real-time updates for tracked emails
   */
  static subscribeToChanges(
    callback: (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: Record<string, unknown>;
      old: Record<string, unknown>;
      errors: string[] | null;
    }) => void
  ) {
    const subscription = supabase
      .channel("tracked_emails_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tracked_emails",
        },
        callback
      )
      .subscribe();

    return subscription;
  }
}
