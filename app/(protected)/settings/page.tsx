import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { followupTemplateService } from "@/lib/services/followup-template.service";
import { FollowupTemplateWithStats } from "@/lib/types/followup.types";
import { SettingsPageClient } from "./settings-page-client";

export default async function SettingsPage() {
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

  // Prepare data for different tabs based on role
  // All data fetching happens in parallel for performance
  const dataPromises = [];

  // Data for Functions tab (admin only)
  let availableMailboxes: {
    id: string;
    email_address: string;
    is_active: boolean;
  }[] = [];
  if (userData.role === "administrateur") {
    dataPromises.push(
      supabase
        .from("mailboxes")
        .select("id, email_address, is_active")
        .eq("is_active", true)
        .order("email_address")
        .then(({ data }) => {
          availableMailboxes = (data || []).filter(
            (
              m
            ): m is { id: string; email_address: string; is_active: boolean } =>
              m.is_active === true
          );
        })
    );
  }

  // Data for Followup Templates tab
  let initialTemplates: FollowupTemplateWithStats[] = [];
  dataPromises.push(
    followupTemplateService
      .getTemplates({
        pagination: {
          page: 1,
          per_page: 100,
          sort_by: "updated_at",
          sort_order: "desc",
        },
        include_stats: true,
      })
      .then(result => {
        initialTemplates = (result.data || []) as FollowupTemplateWithStats[];
      })
      .catch(error => {
        console.error("Error loading initial templates:", error);
      })
  );

  // Wait for all data to be fetched
  await Promise.all(dataPromises);

  // Determine which tabs should be visible based on role
  const visibleTabs = {
    users: true, // Both admin and manager
    mailboxes: true, // Both admin and manager
    templates: true, // Both admin and manager
    settings: userData.role === "administrateur", // Admin only
    functions: false, // Removed from configuration
  };

  // Pass all necessary data to the client component
  return (
    <SettingsPageClient
      userRole={userData.role}
      currentUserId={user.id}
      visibleTabs={visibleTabs}
      availableMailboxes={availableMailboxes}
      initialTemplates={initialTemplates}
    />
  );
}
