import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

type FetchType = "initial" | "manual" | "realtime";

export function useDashboardStats() {
  // États séparés pour loading vs refreshing
  const [stats, setStats] = useState<DashboardStats>({
    totalEmails: 0,
    totalResponses: 0,
    responseRate: 0,
    totalFollowups: 0,
    totalMailboxes: 0,
    statusCounts: {},
    manualReviewCount: 0,
    highFollowupCount: 0,
    manualReviewPercentage: 0,
  });
  const [loading, setLoading] = useState(true); // Chargement initial uniquement
  const [refreshing, setRefreshing] = useState(false); // Rafraîchissement manuel
  const [error, setError] = useState<string | null>(null);

  // Refs pour stabilité et éviter les re-renders infinis
  const initialLoadRef = useRef(true);
  const fetchStatsRef = useRef<
    ((type: FetchType) => Promise<void>) | undefined
  >(undefined);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const mountedRef = useRef(true);

  // Fonction de fetch avec gestion intelligente du loading
  const fetchStats = useCallback(async (type: FetchType = "initial") => {
    try {
      // Gestion des états de chargement selon le type
      if (type === "initial") {
        setLoading(true);
      } else if (type === "manual") {
        setRefreshing(true);
      }
      // type === 'realtime' → Pas d'indicateur de chargement (mise à jour silencieuse)

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

      // Get emails requiring manual review count
      const { count: manualReviewCount, error: manualReviewError } =
        await supabase
          .from("tracked_emails")
          .select("*", { count: "exact", head: true })
          .eq("requires_manual_review", true);

      if (manualReviewError) throw manualReviewError;

      // Get emails with 4+ followups count
      const { count: highFollowupCount, error: highFollowupError } =
        await supabase
          .from("tracked_emails")
          .select("*", { count: "exact", head: true })
          .gte("followup_count", 4);

      if (highFollowupError) throw highFollowupError;

      // Calculate response rate
      const responseRate =
        totalEmails > 0
          ? Math.round(((totalResponses || 0) / totalEmails) * 100)
          : 0;

      // Calculate manual review percentage
      const manualReviewPercentage =
        totalEmails > 0
          ? Math.round(((manualReviewCount || 0) / totalEmails) * 100)
          : 0;

      // Seulement mettre à jour si le composant est monté
      if (mountedRef.current) {
        setStats({
          totalEmails,
          totalResponses: totalResponses || 0,
          responseRate,
          totalFollowups: totalFollowups || 0,
          totalMailboxes: totalMailboxes || 0,
          statusCounts,
          manualReviewCount: manualReviewCount || 0,
          highFollowupCount: highFollowupCount || 0,
          manualReviewPercentage,
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch dashboard stats"
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []); // ✅ Dépendances vides - fonction stable

  // Garder la référence à jour pour les subscriptions
  useEffect(() => {
    fetchStatsRef.current = fetchStats;
  });

  // Debounced realtime update pour éviter trop de refetch
  const debouncedRealtimeUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchStatsRef.current?.("realtime");
    }, 300); // 300ms de délai pour grouper les événements rapides
  }, []);

  // Chargement initial uniquement
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false; // ✅ Marquer AVANT l'appel pour éviter race condition
      fetchStats("initial");
    }
  }, [fetchStats]); // ✅ Ajouter fetchStats pour cohérence

  // Real-time subscription avec debounce
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
        debouncedRealtimeUpdate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_responses",
        },
        debouncedRealtimeUpdate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "followups",
        },
        debouncedRealtimeUpdate
      )
      .subscribe();

    return () => {
      // Cleanup du debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      subscription.unsubscribe();
    };
  }, [debouncedRealtimeUpdate]); // ✅ debouncedRealtimeUpdate est stable

  // Cleanup au démontage du composant
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fonction de refetch manuel avec indicateur visuel
  const refetch = useCallback(() => {
    return fetchStats("manual");
  }, [fetchStats]);

  return {
    stats,
    loading, // true seulement au chargement initial
    refreshing, // true pendant les refetch manuels
    error,
    refetch, // Pour les refetch manuels depuis l'UI
  };
}
