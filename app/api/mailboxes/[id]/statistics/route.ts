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
    const statistics = await mailboxService.getMailboxStatistics(id);

    return NextResponse.json({ data: statistics });
  } catch (error) {
    console.error("Error fetching mailbox statistics:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des statistiques",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
