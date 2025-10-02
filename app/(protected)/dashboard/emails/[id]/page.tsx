import { Metadata } from "next";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
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
      {/* Header Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
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
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Détails de l&apos;email
          </h1>
          <p className="text-muted-foreground">
            Informations complètes et historique de suivi
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Suspense fallback={<EmailDetailsSkeleton />}>
        <EmailDetailsCard emailId={id} />
      </Suspense>
    </div>
  );
}
