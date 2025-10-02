import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { microsoftGraphService } from "@/lib/services/microsoft-graph.service";

interface RouteParams {
  params: Promise<{
    messageId: string;
    attachmentId: string;
  }>;
}

/**
 * GET /api/attachments/[messageId]/[attachmentId]
 * Télécharge une pièce jointe d'un message
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, attachmentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const mailboxId = searchParams.get("mailboxId");

    if (!mailboxId) {
      return NextResponse.json(
        { error: "mailboxId is required" },
        { status: 400 }
      );
    }

    // Récupérer les informations de la mailbox
    const { data: mailbox, error: mailboxError } = await supabase
      .from("mailboxes")
      .select("microsoft_user_id")
      .eq("id", mailboxId)
      .single();

    if (mailboxError || !mailbox?.microsoft_user_id) {
      return NextResponse.json(
        { error: "Mailbox not found or not configured" },
        { status: 404 }
      );
    }

    // Récupérer la pièce jointe depuis Microsoft Graph
    const attachment = await microsoftGraphService.getAttachment(
      mailbox.microsoft_user_id,
      messageId,
      attachmentId
    );

    // Vérifier que c'est bien un FileAttachment
    if (attachment["@odata.type"] !== "#microsoft.graph.fileAttachment") {
      return NextResponse.json(
        { error: "Only file attachments are supported for download" },
        { status: 400 }
      );
    }

    if (!attachment.contentBytes) {
      return NextResponse.json(
        { error: "Attachment content not available" },
        { status: 404 }
      );
    }

    // Décoder le contenu base64
    const buffer = Buffer.from(attachment.contentBytes as string, "base64");

    // Retourner le fichier avec les bons headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": attachment.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${attachment.name}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[API] Error downloading attachment:", error);
    return NextResponse.json(
      {
        error: "Failed to download attachment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
