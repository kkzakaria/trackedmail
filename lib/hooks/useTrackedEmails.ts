import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  TrackedEmailService,
  type TrackedEmailFilters,
  type TrackedEmailListOptions,
} from "@/lib/services/tracked-email.service";
import type { TrackedEmailWithDetails, EmailStatus } from "@/lib/types";

type FetchType = "initial" | "manual" | "realtime";

export interface UseTrackedEmailsResult {
  emails: TrackedEmailWithDetails[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<string, number>;

  // Actions
  refetch: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setFilters: (filters: TrackedEmailFilters) => void;
  setSorting: (sortBy: string, sortOrder: "asc" | "desc") => void;
  updateEmailStatus: (emailId: string, status: EmailStatus) => Promise<void>;
  bulkUpdateStatus: (emailIds: string[], status: EmailStatus) => Promise<void>;
}

export function useTrackedEmails(
  initialOptions: TrackedEmailListOptions = {}
): UseTrackedEmailsResult {
  // Note: useAuth() is called to maintain auth context, but we don't use user directly
  // Supabase client and RLS policies handle authentication automatically
  useAuth();
  const [emails, setEmails] = useState<TrackedEmailWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // Refs pour stabilité
  const initialLoadRef = useRef(true);
  const fetchEmailsRef = useRef<
    ((type: FetchType) => Promise<void>) | undefined
  >(undefined);
  const fetchStatusCountsRef = useRef<(() => Promise<void>) | undefined>(
    undefined
  );
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const mountedRef = useRef(true);

  // Options state
  const [options, setOptions] = useState<TrackedEmailListOptions>({
    page: 0,
    pageSize: 10,
    sortBy: "sent_at",
    sortOrder: "desc",
    filters: {},
    ...initialOptions,
  });

  const fetchEmails = useCallback(
    async (type: FetchType = "initial") => {
      // ✅ Don't check for user - Supabase client handles auth automatically
      // The RLS policies will enforce access control

      try {
        // Gestion des états de chargement selon le type
        if (type === "initial") {
          setLoading(true);
        } else if (type === "manual") {
          setRefreshing(true);
        }
        // type === 'realtime' → Pas d'indicateur de chargement

        setError(null);

        const result = await TrackedEmailService.getTrackedEmails(options);

        if (mountedRef.current) {
          setEmails(result.data);
          setCount(result.count);
        }
      } catch (err) {
        console.error("[useTrackedEmails] Error fetching emails:", err);
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch emails"
          );
          setEmails([]);
          setCount(0);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [options]
  ); // user not needed - Supabase handles auth

  const fetchStatusCounts = useCallback(async () => {
    // ✅ Don't check for user - Supabase handles auth
    try {
      const counts = await TrackedEmailService.getStatusCounts();
      if (mountedRef.current) {
        setStatusCounts(counts || {});
      }
    } catch (err) {
      console.error("Failed to fetch status counts:", err);
    }
  }, []); // ✅ No user dependency

  // Garder les références à jour
  useEffect(() => {
    fetchEmailsRef.current = fetchEmails;
    fetchStatusCountsRef.current = fetchStatusCounts;
  });

  // Debounced realtime update
  const debouncedRealtimeUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchEmailsRef.current?.("realtime");
      fetchStatusCountsRef.current?.();
    }, 300);
  }, []);

  // Initial fetch only - Use refs to avoid dependency issues
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      fetchEmailsRef.current?.("initial");
      fetchStatusCountsRef.current?.();
    }
  }, []); // Empty deps - only run once on mount

  // Re-fetch when options change (pagination, filters, sorting)
  // Use stable dependencies instead of the entire options object
  const serializedFilters = JSON.stringify(options.filters);

  useEffect(() => {
    if (!initialLoadRef.current && fetchEmailsRef.current) {
      fetchEmailsRef.current("manual");
    }
    // Only re-run when actual option values change, not object reference
  }, [
    options.page,
    options.pageSize,
    options.sortBy,
    options.sortOrder,
    serializedFilters, // Serialized filters for stable comparison
  ]);

  // Real-time subscription avec debounce
  useEffect(() => {
    // ✅ Subscribe immediately, Supabase handles auth
    const subscription = TrackedEmailService.subscribeToChanges(() => {
      debouncedRealtimeUpdate();
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      subscription.unsubscribe();
    };
  }, [debouncedRealtimeUpdate]); // ✅ No user dependency

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Actions
  const refetch = useCallback(async () => {
    await Promise.all([fetchEmails("manual"), fetchStatusCounts()]);
  }, [fetchEmails, fetchStatusCounts]);

  const setPage = useCallback((page: number) => {
    setOptions(prev => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setOptions(prev => ({ ...prev, pageSize, page: 0 }));
  }, []);

  const setFilters = useCallback((filters: TrackedEmailFilters) => {
    setOptions(prev => ({ ...prev, filters, page: 0 }));
  }, []);

  const setSorting = useCallback(
    (sortBy: string, sortOrder: "asc" | "desc") => {
      setOptions(prev => ({ ...prev, sortBy, sortOrder }));
    },
    []
  );

  const updateEmailStatus = useCallback(
    async (emailId: string, status: EmailStatus) => {
      try {
        await TrackedEmailService.updateEmailStatus(emailId, status);

        // Optimistic update
        setEmails(prev =>
          prev.map(email =>
            email.id === emailId
              ? {
                  ...email,
                  status,
                  stopped_at:
                    status === "stopped"
                      ? new Date().toISOString()
                      : email.stopped_at,
                }
              : email
          )
        );

        // Refetch to ensure consistency
        await refetch();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update email status"
        );
        throw err;
      }
    },
    [refetch]
  );

  const bulkUpdateStatus = useCallback(
    async (emailIds: string[], status: EmailStatus) => {
      try {
        await TrackedEmailService.bulkUpdateStatus(emailIds, status);

        // Optimistic update
        setEmails(prev =>
          prev.map(email =>
            emailIds.includes(email.id)
              ? {
                  ...email,
                  status,
                  stopped_at:
                    status === "stopped"
                      ? new Date().toISOString()
                      : email.stopped_at,
                }
              : email
          )
        );

        // Refetch to ensure consistency
        await refetch();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to bulk update email status"
        );
        throw err;
      }
    },
    [refetch]
  );

  return {
    emails,
    loading,
    refreshing,
    error,
    count,
    page: options.page || 0,
    pageSize: options.pageSize || 10,
    totalPages: Math.ceil(count / (options.pageSize || 10)),
    statusCounts,

    // Actions
    refetch,
    setPage,
    setPageSize,
    setFilters,
    setSorting,
    updateEmailStatus,
    bulkUpdateStatus,
  };
}
