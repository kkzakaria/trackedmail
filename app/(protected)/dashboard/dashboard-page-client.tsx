"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Users, BarChart3, Settings, Loader2 } from "lucide-react";
import TrackedEmailsTable from "@/components/tracked-emails/TrackedEmailsTable";
import { useDashboardStats } from "@/lib/hooks/useDashboardStats";

interface User {
  id: string;
  email: string | undefined;
  full_name: string | null | undefined;
  role: string | undefined;
}

interface DashboardPageClientProps {
  user: User;
}

export function DashboardPageClient({ user }: DashboardPageClientProps) {
  const { stats, loading, error } = useDashboardStats();
  return (
    <div className="bg-background min-h-screen">
      {/* Main Content */}
      <main className="mx-auto max-w-7xl py-2 sm:px-6 lg:px-8">
        <div className="px-4 py-2 sm:px-0">
          {/* Welcome Section */}
          <div className="mb-8">
            <p className="text-gray-600 dark:text-gray-300">
              Bienvenue {user?.full_name || user?.email}. Gérez vos e-mails
              trackés et suivez vos performances.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  E-mails trackés
                </CardTitle>
                <Mail className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : error ? (
                    "—"
                  ) : (
                    stats.totalEmails
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {stats.totalEmails === 0
                    ? "Aucun e-mail tracké pour le moment"
                    : `${stats.totalEmails} email${stats.totalEmails > 1 ? "s" : ""} suivi${stats.totalEmails > 1 ? "s" : ""}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Réponses reçues
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-green-500 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : error ? (
                    "—"
                  ) : (
                    stats.totalResponses
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  Taux de réponse: {loading ? "..." : `${stats.responseRate}%`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Follow-ups envoyés
                </CardTitle>
                <Users className="h-4 w-4 text-orange-500 dark:text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : error ? (
                    "—"
                  ) : (
                    stats.totalFollowups
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {stats.totalFollowups === 0
                    ? "Aucun follow-up envoyé"
                    : `${stats.totalFollowups} relance${stats.totalFollowups > 1 ? "s" : ""} envoyée${stats.totalFollowups > 1 ? "s" : ""}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Boîtes mail
                </CardTitle>
                <Settings className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : error ? (
                    "—"
                  ) : (
                    stats.totalMailboxes
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {stats.totalMailboxes === 0
                    ? "Configurez vos boîtes mail"
                    : `${stats.totalMailboxes} boîte${stats.totalMailboxes > 1 ? "s" : ""} configurée${stats.totalMailboxes > 1 ? "s" : ""}`}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tracked Emails Section */}
          <div className="mb-8">
            <Card>
              <CardContent className="px-6 py-4">
                <TrackedEmailsTable />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
