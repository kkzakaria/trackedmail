/**
 * API Route - Tracked Email Thread
 * Récupère le thread complet incluant les réponses détectées manuellement
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { microsoftGraphService } from "@/lib/services/microsoft-graph.service";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET - Récupère le thread complet d'un email tracké
 * Charge tous les threads via Microsoft Graph (email original + réponses détectées)
 */
export async function GET(_request: NextRequest, context: RouteParams) {
  try {
    const supabase = await createClient();

    // Vérification de l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: trackedEmailId } = await context.params;

    if (!trackedEmailId) {
      return NextResponse.json(
        { error: "Tracked email ID is required" },
        { status: 400 }
      );
    }

    // 1. Récupérer le tracked email avec la mailbox
    const { data: trackedEmail, error: trackedError } = await supabase
      .from("tracked_emails")
      .select(
        `
        id,
        conversation_id,
        mailbox:mailboxes!inner (
          id,
          email_address,
          microsoft_user_id
        )
      `
      )
      .eq("id", trackedEmailId)
      .single();

    if (trackedError || !trackedEmail) {
      return NextResponse.json(
        { error: "Tracked email not found" },
        { status: 404 }
      );
    }

    if (!trackedEmail.mailbox?.microsoft_user_id) {
      return NextResponse.json(
        { error: "Mailbox not configured with Microsoft User ID" },
        { status: 400 }
      );
    }

    // 2. Récupérer les réponses détectées (juste les conversation_id)
    const { data: responses, error: responsesError } = await supabase
      .from("email_responses")
      .select("conversation_id")
      .eq("tracked_email_id", trackedEmailId)
      .not("conversation_id", "is", null);

    if (responsesError) {
      console.error("Error fetching responses:", responsesError);
    }

    // 3. Collecter tous les conversation_ids uniques
    const conversationIds = new Set<string>();

    // Ajouter le conversation_id de l'email original
    if (trackedEmail.conversation_id) {
      conversationIds.add(trackedEmail.conversation_id);
    }

    // Ajouter les conversation_ids des réponses détectées
    if (responses && responses.length > 0) {
      responses.forEach(response => {
        if (response.conversation_id) {
          conversationIds.add(response.conversation_id);
        }
      });
    }

    console.log(
      `[Thread API] Loading ${conversationIds.size} conversation(s) for tracked email ${trackedEmailId}`
    );

    // 4. Charger TOUS les threads via Microsoft Graph
    const allMessages = [];
    for (const conversationId of conversationIds) {
      try {
        const messages = await microsoftGraphService.getConversationThread(
          trackedEmail.mailbox.microsoft_user_id,
          conversationId
        );
        console.log(
          `[Thread API] Loaded ${messages.length} message(s) from conversation ${conversationId}`
        );
        allMessages.push(...messages);
      } catch (error) {
        console.error(`Error loading conversation ${conversationId}:`, error);
        // Continue avec les autres conversations même si une échoue
      }
    }

    // 5. Dédupliquer par ID (au cas où) et trier par date
    const uniqueMessages = Array.from(
      new Map(allMessages.map(m => [m.id, m])).values()
    ).sort(
      (a, b) =>
        new Date(a.sentDateTime).getTime() - new Date(b.sentDateTime).getTime()
    );

    console.log(`[Thread API] Total unique messages: ${uniqueMessages.length}`);

    return NextResponse.json({
      success: true,
      data: {
        trackedEmailId,
        mailboxEmail: trackedEmail.mailbox.email_address,
        messages: uniqueMessages,
        count: uniqueMessages.length,
        conversationIds: Array.from(conversationIds),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching tracked email thread:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch thread",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
