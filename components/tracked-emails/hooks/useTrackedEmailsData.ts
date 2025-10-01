/**
 * useTrackedEmailsData Hook (avec Supabase Realtime)
 *
 * Manages data loading and real-time updates for tracked emails.
 * Follows Single Responsibility Principle - handles data fetching and real-time synchronization.
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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
 * Hook to manage tracked emails data loading with real-time updates
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

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();

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
              // Nouvel email : enrichir et ajouter au début
              try {
                const newEmailId = (payload.new as { id: string }).id;
                const enrichedEmail =
                  await TrackedEmailService.getTrackedEmailById(newEmailId);

                if (enrichedEmail) {
                  setData(prev => [enrichedEmail, ...prev]);
                  toast.success("Nouveau email détecté");
                }
              } catch (err) {
                console.error("Failed to enrich new email:", err);
              }
              break;
            }

            case "UPDATE": {
              // Mise à jour : enrichir l'email pour avoir les données complètes
              const updatedId = (payload.new as { id: string }).id;

              try {
                const enrichedEmail =
                  await TrackedEmailService.getTrackedEmailById(updatedId);

                if (enrichedEmail) {
                  setData(prev =>
                    prev.map(email =>
                      email.id === updatedId ? enrichedEmail : email
                    )
                  );
                }
              } catch (err) {
                console.error("Failed to enrich updated email:", err);
                // Fallback : simple merge
                setData(prev =>
                  prev.map(email =>
                    email.id === updatedId
                      ? {
                          ...email,
                          ...(payload.new as Partial<TrackedEmailWithDetails>),
                        }
                      : email
                  )
                );
              }
              break;
            }

            case "DELETE": {
              // Suppression : retirer de la liste
              const deletedId = (payload.old as { id: string }).id;

              setData(prev => prev.filter(email => email.id !== deletedId));
              toast.info("Email supprimé");
              break;
            }
          }
        }
      )
      .subscribe();

    // Cleanup : se désabonner lors du démontage
    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Dépendances vides : s'abonne une seule fois au montage

  return {
    data,
    setData,
    loading,
    error,
    refetch: fetchEmails,
  };
}
