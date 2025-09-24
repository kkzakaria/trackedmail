import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MailboxDetailPageClient } from "./mailbox-detail-page-client";

export default async function MailboxDetailPage({
  params,
}: {
  params: { id: string };
}) {
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

  // Pass data to client component
  return <MailboxDetailPageClient mailboxId={params.id} user={userData} />;
}
