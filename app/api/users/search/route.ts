import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UserService } from "@/lib/services/user.service";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Check user role - only admins and managers can search users
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

    const url = new URL(req.url);
    const searchTerm = url.searchParams.get("q");
    const limit = url.searchParams.get("limit");

    if (!searchTerm || searchTerm.trim().length < 2) {
      return NextResponse.json(
        { error: "Le terme de recherche doit contenir au moins 2 caractères" },
        { status: 400 }
      );
    }

    const userService = new UserService(supabase);
    const results = await userService.searchUsers(
      searchTerm.trim(),
      limit ? parseInt(limit) : 10
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la recherche d'utilisateurs",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
