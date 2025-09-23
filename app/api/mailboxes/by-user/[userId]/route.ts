/**
 * API Route - Mailbox by Microsoft User ID
 * Endpoint pour récupérer une mailbox par son Microsoft User ID
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET - Récupère une mailbox par Microsoft User ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: microsoftUserId } = await params;
    const supabase = await createClient();

    // Pour les appels internes (webhooks), on peut skip l'auth
    const isInternalCall = request.headers.get("x-internal-call") === "true";

    if (!isInternalCall) {
      // Vérification de l'authentification pour les appels externes
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!microsoftUserId) {
      return NextResponse.json(
        { error: "Microsoft User ID is required" },
        { status: 400 }
      );
    }

    // Récupérer la mailbox
    const { data: mailbox, error } = await supabase
      .from("mailboxes")
      .select("id, email_address, display_name, microsoft_user_id, is_active")
      .eq("microsoft_user_id", microsoftUserId)
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!mailbox) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      mailbox,
    });
  } catch (error) {
    console.error("Error getting mailbox by user ID:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
