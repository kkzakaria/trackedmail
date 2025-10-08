import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardPageClient } from "./dashboard-page-client";
import { getDashboardStats } from "@/lib/services/dashboard-stats.server";
import { getTrackedEmails } from "@/lib/services/tracked-email.server";

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

  // 🚀 OPTIMIZATION: Pre-fetch dashboard data on server for instant display
  // Parallelizes stats and emails fetching for optimal performance
  const [initialStats, initialEmails] = await Promise.all([
    getDashboardStats().catch(err => {
      console.error("Failed to fetch dashboard stats:", err);
      return null;
    }),
    getTrackedEmails({ page: 0, pageSize: 50 }).catch(err => {
      console.error("Failed to fetch tracked emails:", err);
      return null;
    }),
  ]);

  // Pass user data and initial data to client component
  return (
    <DashboardPageClient
      user={userWithRole}
      initialStats={initialStats}
      initialEmails={initialEmails?.data || null}
    />
  );
}
