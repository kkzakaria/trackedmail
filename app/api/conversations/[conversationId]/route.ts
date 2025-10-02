/**
 * API Route - Email Conversation Thread
 * Récupère tous les messages d'une conversation via Microsoft Graph
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { microsoftGraphService } from "@/lib/services/microsoft-graph.service";

interface RouteParams {
  params: Promise<{
    conversationId: string;
  }>;
}

/**
 * GET - Récupère le fil de conversation complet
 */
export async function GET(request: NextRequest, context: RouteParams) {
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

    const { conversationId } = await context.params;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    // Récupérer le mailbox_id depuis les query params ou le tracked_email
    const { searchParams } = new URL(request.url);
    const mailboxId = searchParams.get("mailboxId");

    if (!mailboxId) {
      return NextResponse.json(
        { error: "Mailbox ID is required" },
        { status: 400 }
      );
    }

    // Récupérer les informations de la mailbox
    const { data: mailbox, error: mailboxError } = await supabase
      .from("mailboxes")
      .select("email_address, microsoft_user_id")
      .eq("id", mailboxId)
      .single();

    if (mailboxError || !mailbox) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    if (!mailbox.microsoft_user_id) {
      return NextResponse.json(
        { error: "Mailbox not configured with Microsoft User ID" },
        { status: 400 }
      );
    }

    // Récupérer les messages de la conversation via Microsoft Graph
    const messages = await microsoftGraphService.getConversationThread(
      mailbox.microsoft_user_id,
      conversationId
    );

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        mailboxEmail: mailbox.email_address,
        messages,
        count: messages.length,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching conversation:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch conversation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
