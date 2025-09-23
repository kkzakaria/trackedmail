import { Metadata } from "next";
import TrackedEmailsTable from "@/components/tracked-emails/TrackedEmailsTable";

export const metadata: Metadata = {
  title: "Suivi des emails | TrackedMail",
  description: "Interface de suivi et gestion des emails envoyés avec détection automatique des réponses.",
};

export default function EmailsPage() {
  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suivi des emails</h1>
          <p className="text-muted-foreground">
            Gérez et suivez tous vos emails envoyés avec détection automatique des réponses.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <TrackedEmailsTable />
    </div>
  );
}