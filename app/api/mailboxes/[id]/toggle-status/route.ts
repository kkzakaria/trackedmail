import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MailboxService } from "@/lib/services/mailbox.service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier les permissions
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !userData ||
      (userData.role !== "administrateur" && userData.role !== "manager")
    ) {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const mailboxService = new MailboxService(supabase);
    const updatedMailbox = await mailboxService.toggleMailboxStatus(id);

    return NextResponse.json({ data: updatedMailbox });
  } catch (error) {
    console.error("Error toggling mailbox status:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la modification du statut",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
