import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FollowupSettingsPageClient } from "./followup-settings-page-client";

export default async function FollowupSettingsPage() {
  // Server-side authentication check
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Redirect if not authenticated
  if (error || !user) {
    redirect("/login");
  }

  // Check user role from the database
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // Redirect if not authorized (admin only for settings)
  if (!userData || userData.role !== "administrateur") {
    redirect("/dashboard");
  }

  // Pass to client component
  return <FollowupSettingsPageClient />;
}
