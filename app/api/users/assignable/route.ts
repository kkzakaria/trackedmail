import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UserService } from "@/lib/services/user.service";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Check user role - only admins and managers can get assignable users
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
        {
          error: "Permissions insuffisantes.",
        },
        { status: 403 }
      );
    }

    const userService = new UserService(supabase);
    const assignableUsers = await userService.getAssignableUsers();

    return NextResponse.json({
      success: true,
      data: assignableUsers,
    });
  } catch (error) {
    console.error("Error fetching assignable users:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des utilisateurs assignables",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
