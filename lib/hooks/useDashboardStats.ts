import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface DashboardStats {
  totalEmails: number;
  totalResponses: number;
  responseRate: number;
  totalFollowups: number;
  totalMailboxes: number;
  statusCounts: Record<string, number>;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmails: 0,
    totalResponses: 0,
    responseRate: 0,
    totalFollowups: 0,
    totalMailboxes: 0,
    statusCounts: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Get all tracked emails count and status distribution
      const { data: emailsData, error: emailsError } = await supabase
        .from("tracked_emails")
        .select("status");

      if (emailsError) throw emailsError;

      const totalEmails = emailsData?.length || 0;
      const statusCounts =
        emailsData?.reduce((acc: Record<string, number>, email) => {
          acc[email.status] = (acc[email.status] || 0) + 1;
          return acc;
        }, {}) || {};

      // Get total responses count (excluding auto-responses)
      const { count: totalResponses, error: responsesError } = await supabase
        .from("email_responses")
        .select("*", { count: "exact", head: true })
        .eq("is_auto_response", false);

      if (responsesError) throw responsesError;

      // Get total followups count
      const { count: totalFollowups, error: followupsError } = await supabase
        .from("followups")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent");

      if (followupsError) throw followupsError;

      // Get total mailboxes count
      const { count: totalMailboxes, error: mailboxesError } = await supabase
        .from("mailboxes")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (mailboxesError) throw mailboxesError;

      // Calculate response rate
      const responseRate =
        totalEmails > 0
          ? Math.round(((totalResponses || 0) / totalEmails) * 100)
          : 0;

      setStats({
        totalEmails,
        totalResponses: totalResponses || 0,
        responseRate,
        totalFollowups: totalFollowups || 0,
        totalMailboxes: totalMailboxes || 0,
        statusCounts,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch dashboard stats"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();

    const subscription = supabase
      .channel("dashboard_stats_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tracked_emails",
        },
        () => {
          // Refetch stats when tracked emails change
          fetchStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_responses",
        },
        () => {
          // Refetch stats when responses change
          fetchStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "followups",
        },
        () => {
          // Refetch stats when followups change
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}
