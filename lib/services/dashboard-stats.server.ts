/**
 * Dashboard Stats Service (Server-Side)
 *
 * This service provides server-side data fetching for dashboard statistics.
 * It mirrors the client-side useDashboardStats hook but optimized for server components.
 */

import { createClient } from "@/lib/supabase/server";

export interface DashboardStats {
  totalEmails: number;
  totalResponses: number;
  responseRate: number;
  totalFollowups: number;
  totalMailboxes: number;
  statusCounts: Record<string, number>;
  manualReviewCount: number;
  highFollowupCount: number;
  manualReviewPercentage: number;
}

/**
 * Fetch dashboard statistics on the server
 * Uses Promise.all for optimal performance
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  // 🚀 OPTIMIZATION: Parallelize all queries with Promise.all
  // Same optimization as client-side but runs on server for SSR
  const [
    emailsResult,
    responsesResult,
    followupsResult,
    mailboxesResult,
    manualReviewResult,
    highFollowupResult,
  ] = await Promise.all([
    // Get all tracked emails count and status distribution
    supabase.from("tracked_emails").select("status"),

    // Get total responses count (excluding auto-responses)
    supabase
      .from("email_responses")
      .select("*", { count: "exact", head: true })
      .eq("is_auto_response", false),

    // Get total followups count
    supabase
      .from("followups")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent"),

    // Get total mailboxes count
    supabase
      .from("mailboxes")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),

    // Get emails requiring manual review count
    supabase
      .from("tracked_emails")
      .select("*", { count: "exact", head: true })
      .eq("requires_manual_review", true),

    // Get emails with 4+ followups count
    supabase
      .from("tracked_emails")
      .select("*", { count: "exact", head: true })
      .gte("followup_count", 4),
  ]);

  // Check for errors
  if (emailsResult.error) throw emailsResult.error;
  if (responsesResult.error) throw responsesResult.error;
  if (followupsResult.error) throw followupsResult.error;
  if (mailboxesResult.error) throw mailboxesResult.error;
  if (manualReviewResult.error) throw manualReviewResult.error;
  if (highFollowupResult.error) throw highFollowupResult.error;

  // Extract data
  const emailsData = emailsResult.data;
  const totalEmails = emailsData?.length || 0;
  const statusCounts =
    emailsData?.reduce((acc: Record<string, number>, email) => {
      acc[email.status] = (acc[email.status] || 0) + 1;
      return acc;
    }, {}) || {};

  const totalResponses = responsesResult.count || 0;
  const totalFollowups = followupsResult.count || 0;
  const totalMailboxes = mailboxesResult.count || 0;
  const manualReviewCount = manualReviewResult.count || 0;
  const highFollowupCount = highFollowupResult.count || 0;

  // Calculate response rate
  const responseRate =
    totalEmails > 0 ? Math.round((totalResponses / totalEmails) * 100) : 0;

  // Calculate manual review percentage
  const manualReviewPercentage =
    totalEmails > 0 ? Math.round((manualReviewCount / totalEmails) * 100) : 0;

  return {
    totalEmails,
    totalResponses,
    responseRate,
    totalFollowups,
    totalMailboxes,
    statusCounts,
    manualReviewCount,
    highFollowupCount,
    manualReviewPercentage,
  };
}
