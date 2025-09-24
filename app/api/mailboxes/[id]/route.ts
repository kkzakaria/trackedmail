import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MailboxService } from "@/lib/services/mailbox.service";

export async function GET(
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

    const mailboxService = new MailboxService(supabase);
    const mailbox = await mailboxService.getMailboxById(id);

    return NextResponse.json({ data: mailbox });
  } catch (error) {
    console.error("Error fetching mailbox:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération de la boîte mail",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
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

    const updates = await req.json();
    const mailboxService = new MailboxService(supabase);
    const updatedMailbox = await mailboxService.updateMailbox(id, updates);

    return NextResponse.json({ data: updatedMailbox });
  } catch (error) {
    console.error("Error updating mailbox:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la mise à jour de la boîte mail",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    if (!userData || userData.role !== "administrateur") {
      return NextResponse.json(
        {
          error: "Seuls les administrateurs peuvent supprimer des boîtes mail",
        },
        { status: 403 }
      );
    }

    const mailboxService = new MailboxService(supabase);
    await mailboxService.deleteMailbox(id);

    return NextResponse.json({ message: "Boîte mail supprimée avec succès" });
  } catch (error) {
    console.error("Error deleting mailbox:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la suppression de la boîte mail",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
