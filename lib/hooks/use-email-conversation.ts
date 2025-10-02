import { useCallback, useEffect, useRef, useState } from "react";
import type { MicrosoftGraphEmailMessage } from "@/lib/types/microsoft-graph";

interface ConversationData {
  conversationId: string;
  mailboxEmail: string;
  messages: MicrosoftGraphEmailMessage[];
  count: number;
}

interface UseEmailConversationResult {
  messages: MicrosoftGraphEmailMessage[];
  loading: boolean;
  error: string | null;
  mailboxEmail: string | null;
  refetch: () => Promise<void>;
}

export function useEmailConversation(
  conversationId: string | null,
  mailboxId: string | null
): UseEmailConversationResult {
  const [messages, setMessages] = useState<MicrosoftGraphEmailMessage[]>([]);
  const [mailboxEmail, setMailboxEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const fetchConversationRef = useRef<(() => Promise<void>) | undefined>(
    undefined
  );

  const fetchConversation = useCallback(async () => {
    if (!conversationId || !mailboxId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/conversations/${conversationId}?mailboxId=${mailboxId}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch conversation");
      }

      const result = await response.json();
      const data = result.data as ConversationData;

      if (mountedRef.current) {
        setMessages(data.messages);
        setMailboxEmail(data.mailboxEmail);
      }
    } catch (err) {
      console.error("[useEmailConversation] Error:", err);
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch conversation"
        );
        setMessages([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [conversationId, mailboxId]);

  // Stocker la référence de la fonction
  fetchConversationRef.current = fetchConversation;

  // Fetch initial
  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (fetchConversationRef.current) {
      await fetchConversationRef.current();
    }
  }, []);

  return {
    messages,
    loading,
    error,
    mailboxEmail,
    refetch,
  };
}
