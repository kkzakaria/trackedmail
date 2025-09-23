import { createClient } from "@/lib/supabase/client";
import type { TrackedEmailWithDetails, EmailStatus, Database } from "@/lib/types";

const supabase = createClient();

type TrackedEmailRow = Database["public"]["Tables"]["tracked_emails"]["Row"];
type MailboxRow = Database["public"]["Tables"]["mailboxes"]["Row"];

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
    let query = supabase
      .from("tracked_emails")
      .select(
        `
        *,
        mailbox:mailboxes!inner(
          id,
          email_address,
          display_name
        )
        `,
        { count: "exact" }
      );

    // Apply filters
    if (filters.search) {
      query = query.or(
        `subject.ilike.%${filters.search}%,recipient_emails.cs.{${filters.search}}`
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
      throw new Error(`Failed to fetch tracked emails: ${error.message}`);
    }

    // Enrich with calculated fields
    const enrichedEmails = await Promise.all(
      (rawEmails || []).map(async (email) => {
        const enriched = await this.enrichTrackedEmail(email);
        return enriched;
      })
    );

    return {
      data: enrichedEmails,
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * Enrich a tracked email with calculated data
   */
  private static async enrichTrackedEmail(email: TrackedEmailRow & { mailbox: MailboxRow }): Promise<TrackedEmailWithDetails> {
    // Get response count
    const { count: responseCount } = await supabase
      .from("email_responses")
      .select("*", { count: "exact", head: true })
      .eq("tracked_email_id", email.id)
      .eq("is_auto_response", false);

    // Get followup count and last sent
    const { data: followups } = await supabase
      .from("followups")
      .select("sent_at")
      .eq("tracked_email_id", email.id)
      .eq("status", "sent")
      .order("sent_at", { ascending: false });

    const followupCount = followups?.length || 0;
    const lastFollowupSent = followups?.[0]?.sent_at || null;

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
      status: email.status,
      sent_at: email.sent_at,
      responded_at: email.responded_at,
      stopped_at: email.stopped_at,
      has_attachments: email.has_attachments,
      importance: email.importance,
      mailbox: email.mailbox,
      response_count: responseCount || 0,
      followup_count: followupCount,
      last_followup_sent: lastFollowupSent,
      days_since_sent: daysSinceSent,
    };
  }

  /**
   * Get status counts for dashboard metrics
   */
  static async getStatusCounts() {
    const { data, error } = await supabase
      .from("tracked_emails")
      .select("status")
      .then(async (result) => {
        if (result.error) throw result.error;

        const counts = result.data.reduce((acc: Record<string, number>, email: { status: string }) => {
          acc[email.status] = (acc[email.status] || 0) + 1;
          return acc;
        }, {});

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
    const updateData: any = { status };

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
    const updateData: any = { status };

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
   * Get tracked email details with full relations
   */
  static async getTrackedEmailById(id: string): Promise<TrackedEmailWithDetails | null> {
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

    return this.enrichTrackedEmail(data);
  }

  /**
   * Subscribe to real-time updates for tracked emails
   */
  static subscribeToChanges(callback: (payload: any) => void) {
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