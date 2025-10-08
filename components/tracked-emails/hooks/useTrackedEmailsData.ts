/**
 * useTrackedEmailsData Hook (avec Supabase Realtime)
 *
 * Manages data loading and real-time updates for tracked emails with server-side pagination.
 * Follows Single Responsibility Principle - handles data fetching and real-time synchronization.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  TrackedEmailService,
  TrackedEmailFilters,
} from "@/lib/services/tracked-email.service";
import type { TrackedEmailWithDetails, EmailStatus } from "@/lib/types";
import type {
  PaginationState,
  ColumnFiltersState,
} from "@tanstack/react-table";

export interface UseTrackedEmailsDataReturn {
  data: TrackedEmailWithDetails[];
  setData: React.Dispatch<React.SetStateAction<TrackedEmailWithDetails[]>>;
  loading: boolean;
  error: Error | null;
  totalCount: number;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  columnFilters: ColumnFiltersState;
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  refetch: () => Promise<void>;
}

/**
 * Hook to manage tracked emails data loading with real-time updates and server-side pagination
 * @param initialData - Optional initial data from server-side rendering
 * @returns Data, loading state, error state, pagination state, and refetch function
 */
/**
 * Build TrackedEmailFilters from TanStack Table column filters
 */
function buildFiltersFromColumnFilters(
  columnFilters: ColumnFiltersState
): TrackedEmailFilters {
  const filters: TrackedEmailFilters = {};

  columnFilters.forEach(filter => {
    if (filter.id === "recipient_emails" && typeof filter.value === "string") {
      // Search filter (searches in subject + recipient_emails server-side)
      filters.search = filter.value;
    } else if (filter.id === "status" && Array.isArray(filter.value)) {
      // Status filter
      filters.status = filter.value as EmailStatus[];
    }
  });

  return filters;
}

export function useTrackedEmailsData(
  initialData?: TrackedEmailWithDetails[] | null
): UseTrackedEmailsDataReturn {
  const [data, setData] = useState<TrackedEmailWithDetails[]>(
    initialData || []
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Debounce timer ref for search
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = buildFiltersFromColumnFilters(columnFilters);

      const result = await TrackedEmailService.getTrackedEmails({
        page: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sortBy: "sent_at",
        sortOrder: "desc",
        filters,
      });
      setData(result.data);
      setTotalCount(result.count);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      console.error("Failed to fetch emails:", error);
      toast.error("Erreur lors du chargement des emails");
    } finally {
      setLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, columnFilters]);

  // Auto-fetch when pagination changes
  useEffect(() => {
    if (
      !initialData ||
      pagination.pageIndex > 0 ||
      pagination.pageSize !== 10
    ) {
      fetchEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.pageIndex, pagination.pageSize]); // Refetch on pagination change

  // Auto-fetch when filters change (with debouncing for search)
  useEffect(() => {
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Check if search filter is present
    const hasSearchFilter = columnFilters.some(
      filter =>
        filter.id === "recipient_emails" && typeof filter.value === "string"
    );

    // Reset pagination to first page when filters change
    setPagination(prev => {
      if (prev.pageIndex !== 0) {
        return { ...prev, pageIndex: 0 };
      }
      return prev;
    });

    // Debounce search filter, immediate for others
    if (hasSearchFilter) {
      debounceTimerRef.current = setTimeout(() => {
        fetchEmails();
      }, 500); // 500ms debounce for search
    } else {
      // Immediate fetch for status filters
      fetchEmails();
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters]); // Refetch on filter change

  // Realtime subscription with batch enrichment optimization
  useEffect(() => {
    const supabase = createClient();

    // 🚀 OPTIMIZATION: Batch enrichment system
    const enrichmentQueue = new Set<string>();
    let enrichmentTimer: NodeJS.Timeout | null = null;

    const processBatchEnrichment = async () => {
      if (enrichmentQueue.size === 0) return;

      const idsToEnrich = Array.from(enrichmentQueue);
      enrichmentQueue.clear();

      try {
        // Batch fetch all updated emails in one go
        const enrichmentPromises = idsToEnrich.map(id =>
          TrackedEmailService.getTrackedEmailById(id)
        );

        const enrichedEmails = await Promise.all(enrichmentPromises);

        // Update all enriched emails at once
        setData(prev => {
          const updated = [...prev];
          enrichedEmails.forEach(enrichedEmail => {
            if (enrichedEmail) {
              const index = updated.findIndex(e => e.id === enrichedEmail.id);
              if (index !== -1) {
                updated[index] = enrichedEmail;
              } else {
                // New email - add at the beginning
                updated.unshift(enrichedEmail);
              }
            }
          });
          return updated;
        });
      } catch (err) {
        console.error("Failed to batch enrich emails:", err);
      }
    };

    const scheduleEnrichment = (emailId: string) => {
      enrichmentQueue.add(emailId);

      if (enrichmentTimer) {
        clearTimeout(enrichmentTimer);
      }

      // Batch window: wait 500ms for more updates, then process all at once
      enrichmentTimer = setTimeout(() => {
        processBatchEnrichment();
        enrichmentTimer = null;
      }, 500);
    };

    // Initialize Realtime subscription
    const initRealtime = async () => {
      // Set auth for Realtime (required for RLS)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
        console.warn("[Realtime] Auth configured successfully");
      }

      const channel = supabase
        .channel("tracked_emails_realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tracked_emails",
          },
          async payload => {
            console.warn("[Realtime] Event received:", payload.eventType);

            switch (payload.eventType) {
              case "INSERT": {
                // Nouvel email : incrémenter totalCount
                setTotalCount(prev => prev + 1);

                // Si on est sur la première page, refetch pour afficher le nouvel email
                setPagination(currentPagination => {
                  if (currentPagination.pageIndex === 0) {
                    // Trigger refetch by updating pagination (will trigger useEffect)
                    fetchEmails();
                  }
                  return currentPagination;
                });

                toast.success("Nouveau email détecté");
                break;
              }

              case "UPDATE": {
                // Mise à jour : vérifier si l'email est dans la page actuelle
                const updatedId = (payload.new as { id: string }).id;

                setData(currentData => {
                  const emailInCurrentPage = currentData.some(
                    email => email.id === updatedId
                  );

                  if (emailInCurrentPage) {
                    // Optimistic update for instant feedback
                    const updated = currentData.map(email =>
                      email.id === updatedId
                        ? {
                            ...email,
                            ...(payload.new as Partial<TrackedEmailWithDetails>),
                          }
                        : email
                    );

                    // Schedule enrichment for complete data
                    scheduleEnrichment(updatedId);

                    return updated;
                  }

                  // Si l'email n'est pas dans la page actuelle, on ignore
                  return currentData;
                });

                break;
              }

              case "DELETE": {
                const deletedId = (payload.old as { id: string }).id;

                // Vérifier si l'email était dans la page actuelle
                setData(currentData => {
                  const emailInCurrentPage = currentData.some(
                    email => email.id === deletedId
                  );

                  if (emailInCurrentPage) {
                    // Refetch pour combler le trou et maintenir pageSize
                    fetchEmails();
                  }

                  return currentData;
                });

                // Décrémenter totalCount et vérifier validité de la page
                setTotalCount(currentTotal => {
                  const newTotal = Math.max(0, currentTotal - 1);

                  setPagination(currentPagination => {
                    const maxPageIndex = Math.max(
                      0,
                      Math.ceil(newTotal / currentPagination.pageSize) - 1
                    );

                    if (currentPagination.pageIndex > maxPageIndex) {
                      return { ...currentPagination, pageIndex: maxPageIndex };
                    }
                    return currentPagination;
                  });

                  return newTotal;
                });

                toast.info("Email supprimé");
                break;
              }
            }
          }
        )
        .subscribe();

      return channel;
    };

    // Initialize and store channel reference
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    initRealtime()
      .then(channel => {
        channelRef = channel;
      })
      .catch(error => {
        console.error("[Realtime] Failed to initialize:", error);
      });

    // Cleanup : se désabonner et clear timer
    return () => {
      if (enrichmentTimer) {
        clearTimeout(enrichmentTimer);
      }
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dépendances vides : s'abonne une seule fois au montage, fetchEmails utilisé via closure

  return {
    data,
    setData,
    loading,
    error,
    totalCount,
    pagination,
    setPagination,
    columnFilters,
    setColumnFilters,
    refetch: fetchEmails,
  };
}
