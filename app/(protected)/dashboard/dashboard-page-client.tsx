"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Users, BarChart3, Settings } from "lucide-react";
import TrackedEmailsTable from "@/components/tracked-emails/TrackedEmailsTable";

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
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="mx-auto max-w-7xl py-2 sm:px-6 lg:px-8">
        <div className="px-4 py-2 sm:px-0">
          {/* Welcome Section */}
          <div className="mb-8">
            <p className="text-gray-600">
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
                <Mail className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-muted-foreground text-xs">
                  Aucun e-mail tracké pour le moment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Réponses reçues
                </CardTitle>
                <BarChart3 className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-muted-foreground text-xs">
                  Taux de réponse: 0%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Follow-ups envoyés
                </CardTitle>
                <Users className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-muted-foreground text-xs">
                  Aucun follow-up programmé
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Boîtes mail
                </CardTitle>
                <Settings className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-muted-foreground text-xs">
                  Configurez vos boîtes mail
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
