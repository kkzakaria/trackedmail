/**
 * Tracked Email Service (Server-Side)
 *
 * This service provides server-side data fetching for tracked emails.
 * Optimized for server components with proper SSR support.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  TrackedEmailWithDetails,
  EmailStatus,
  EmailImportance,
} from "@/lib/types";

export interface TrackedEmailListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Get tracked emails with enriched data (server-side)
 * Uses optimized batch queries to minimize database calls
 */
export async function getTrackedEmails(options: TrackedEmailListOptions = {}) {
  const {
    page = 0,
    pageSize = 50,
    sortBy = "sent_at",
    sortOrder = "desc",
  } = options;

  const supabase = await createClient();

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

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  // Apply pagination
  const start = page * pageSize;
  const end = start + pageSize - 1;
  query = query.range(start, end);

  const { data: rawEmails, error, count } = await query;

  if (error) {
    console.error("[TrackedEmailServer] Query error:", error);
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

  // Enrich emails with the batched data
  const enrichedEmails: TrackedEmailWithDetails[] = rawEmails.map(email => {
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
