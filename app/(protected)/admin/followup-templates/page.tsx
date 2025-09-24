import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { followupTemplateService } from "@/lib/services/followup-template.service";
import { FollowupTemplatesPageClient } from "./followup-templates-page-client";
import { FollowupTemplateWithStats } from "@/lib/types/followup.types";

export default async function FollowupTemplatesPage() {
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

  // Redirect if not authorized (admin or manager only)
  if (
    !userData ||
    (userData.role !== "administrateur" && userData.role !== "manager")
  ) {
    redirect("/dashboard");
  }

  // Fetch initial data server-side
  let initialData: FollowupTemplateWithStats[] = [];
  try {
    const result = await followupTemplateService.getTemplates({
      pagination: {
        page: 1,
        per_page: 100,
        sort_by: "updated_at",
        sort_order: "desc",
      },
      include_stats: true,
    });
    initialData = (result.data || []) as FollowupTemplateWithStats[];
  } catch (error) {
    console.error("Error loading initial templates:", error);
  }

  // Pass initial data to client component
  return <FollowupTemplatesPageClient initialData={initialData} />;
}
