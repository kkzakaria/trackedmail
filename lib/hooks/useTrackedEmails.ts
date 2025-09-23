import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  TrackedEmailService,
  type TrackedEmailFilters,
  type TrackedEmailListOptions,
} from "@/lib/services/tracked-email.service";
import type { TrackedEmailWithDetails, EmailStatus } from "@/lib/types";

export interface UseTrackedEmailsResult {
  emails: TrackedEmailWithDetails[];
  loading: boolean;
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
  const { user } = useAuth();
  const [emails, setEmails] = useState<TrackedEmailWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // Options state
  const [options, setOptions] = useState<TrackedEmailListOptions>({
    page: 0,
    pageSize: 10,
    sortBy: "sent_at",
    sortOrder: "desc",
    filters: {},
    ...initialOptions,
  });

  const fetchEmails = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const result = await TrackedEmailService.getTrackedEmails(options);

      setEmails(result.data);
      setCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch emails");
      setEmails([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, options]);

  const fetchStatusCounts = useCallback(async () => {
    if (!user) return;

    try {
      const counts = await TrackedEmailService.getStatusCounts();
      setStatusCounts(counts || {});
    } catch (err) {
      console.error("Failed to fetch status counts:", err);
    }
  }, [user]);

  // Initial fetch and when options change
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Fetch status counts on mount and when emails change
  useEffect(() => {
    fetchStatusCounts();
  }, [fetchStatusCounts, emails]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const subscription = TrackedEmailService.subscribeToChanges((payload) => {
      console.warn("Real-time update:", payload);

      // Refetch data on any change
      fetchEmails();
      fetchStatusCounts();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchEmails, fetchStatusCounts]);

  // Actions
  const refetch = useCallback(async () => {
    await Promise.all([fetchEmails(), fetchStatusCounts()]);
  }, [fetchEmails, fetchStatusCounts]);

  const setPage = useCallback((page: number) => {
    setOptions((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setOptions((prev) => ({ ...prev, pageSize, page: 0 }));
  }, []);

  const setFilters = useCallback((filters: TrackedEmailFilters) => {
    setOptions((prev) => ({ ...prev, filters, page: 0 }));
  }, []);

  const setSorting = useCallback((sortBy: string, sortOrder: "asc" | "desc") => {
    setOptions((prev) => ({ ...prev, sortBy, sortOrder }));
  }, []);

  const updateEmailStatus = useCallback(
    async (emailId: string, status: EmailStatus) => {
      try {
        await TrackedEmailService.updateEmailStatus(emailId, status);

        // Optimistic update
        setEmails((prev) =>
          prev.map((email) =>
            email.id === emailId
              ? {
                  ...email,
                  status,
                  stopped_at: status === "stopped" ? new Date().toISOString() : email.stopped_at,
                }
              : email
          )
        );

        // Refetch to ensure consistency
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update email status");
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
        setEmails((prev) =>
          prev.map((email) =>
            emailIds.includes(email.id)
              ? {
                  ...email,
                  status,
                  stopped_at: status === "stopped" ? new Date().toISOString() : email.stopped_at,
                }
              : email
          )
        );

        // Refetch to ensure consistency
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to bulk update email status");
        throw err;
      }
    },
    [refetch]
  );

  return {
    emails,
    loading,
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