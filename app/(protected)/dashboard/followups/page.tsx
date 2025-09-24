import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FollowupsPageClient } from "./followups-page-client";

export default async function FollowupsPage() {
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

  // Pass auth info to client component
  return <FollowupsPageClient />;
}
