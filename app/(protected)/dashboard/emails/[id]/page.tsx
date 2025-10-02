import { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import EmailDetailsCard from "@/components/tracked-emails/EmailDetailsCard";

export const metadata: Metadata = {
  title: "Détails de l'email | TrackedMail",
  description:
    "Détails complets d'un email suivi avec historique des réponses et relances.",
};

interface EmailDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

function EmailDetailsSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Skeleton className="h-96 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

export default async function EmailDetailsPage({
  params,
}: EmailDetailsPageProps) {
  const { id } = await params;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <Suspense fallback={<EmailDetailsSkeleton />}>
        <EmailDetailsCard emailId={id} />
      </Suspense>
    </div>
  );
}
