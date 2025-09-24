import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardPageClient } from "./dashboard-page-client";

export default async function DashboardPage() {
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

  // Get user data from database
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  // Merge user data with proper typing
  const userWithRole = userData
    ? {
        id: user.id,
        email: user.email || userData.email,
        full_name: userData.full_name,
        role: userData.role,
      }
    : {
        id: user.id,
        email: user.email,
        full_name: undefined,
        role: undefined,
      };

  // Pass user data to client component
  return <DashboardPageClient user={userWithRole} />;
}
