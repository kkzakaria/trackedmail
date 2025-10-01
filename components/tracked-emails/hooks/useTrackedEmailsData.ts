/**
 * useTrackedEmailsData Hook
 *
 * Manages data loading and state for tracked emails.
 * Follows Single Responsibility Principle - handles only data fetching and state.
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { TrackedEmailService } from "@/lib/services/tracked-email.service";
import type { TrackedEmailWithDetails } from "@/lib/types";

export interface UseTrackedEmailsDataReturn {
  data: TrackedEmailWithDetails[];
  setData: React.Dispatch<React.SetStateAction<TrackedEmailWithDetails[]>>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to manage tracked emails data loading
 * @returns Data, loading state, error state, and refetch function
 */
export function useTrackedEmailsData(): UseTrackedEmailsDataReturn {
  const [data, setData] = useState<TrackedEmailWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await TrackedEmailService.getTrackedEmails({
        page: 0,
        pageSize: 1000, // Load all emails for client-side pagination
        sortBy: "sent_at",
        sortOrder: "desc",
      });
      setData(result.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      console.error("Failed to fetch emails:", error);
      toast.error("Erreur lors du chargement des emails");
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchEmails();
  }, []);

  return {
    data,
    setData,
    loading,
    error,
    refetch: fetchEmails,
  };
}
