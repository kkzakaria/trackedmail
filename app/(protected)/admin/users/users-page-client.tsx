"use client";

import { useState } from "react";
import { UserList } from "@/components/users/UserList";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UsersIcon, UserCheckIcon, UserXIcon, CrownIcon } from "lucide-react";
import { useUsers } from "@/lib/hooks/use-users";

interface UsersPageClientProps {
  userRole: "administrateur" | "manager" | "utilisateur";
}

export function UsersPageClient({ userRole }: UsersPageClientProps) {
  const [selectedTab, setSelectedTab] = useState("all");

  // Get statistics for different user states
  const { data: allUsersData } = useUsers({ limit: 1 }); // Just get count
  const { data: activeUsersData } = useUsers({ isActive: true, limit: 1 });
  const { data: inactiveUsersData } = useUsers({ isActive: false, limit: 1 });

  const totalUsers = allUsersData?.count || 0;
  const activeUsers = activeUsersData?.count || 0;
  const inactiveUsers = inactiveUsersData?.count || 0;

  const canEdit = userRole === "administrateur";
  const canDelete = userRole === "administrateur";
  const canCreate = userRole === "administrateur";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Gestion des utilisateurs
        </h1>
        <p className="text-muted-foreground">
          Gérez les utilisateurs du système, leurs rôles et leurs assignations.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total utilisateurs
            </CardTitle>
            <UsersIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-muted-foreground text-xs">
              Tous les utilisateurs du système
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Utilisateurs actifs
            </CardTitle>
            <UserCheckIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeUsers}
            </div>
            <p className="text-muted-foreground text-xs">
              Utilisateurs ayant accès au système
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Utilisateurs inactifs
            </CardTitle>
            <UserXIcon className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {inactiveUsers}
            </div>
            <p className="text-muted-foreground text-xs">
              Utilisateurs désactivés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Votre rôle</CardTitle>
            <CrownIcon className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant="secondary" className="text-sm">
                {userRole === "administrateur"
                  ? "Admin"
                  : userRole === "manager"
                    ? "Manager"
                    : "Utilisateur"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              Votre niveau d&apos;accès
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Management */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
          <CardDescription>
            Consultez et gérez tous les utilisateurs du système avec leurs rôles
            et statuts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={selectedTab}
            onValueChange={setSelectedTab}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="all">
                Tous les utilisateurs
                <Badge variant="secondary" className="ml-2">
                  {totalUsers}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="active">
                Actifs
                <Badge variant="secondary" className="ml-2">
                  {activeUsers}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="inactive">
                Inactifs
                <Badge variant="secondary" className="ml-2">
                  {inactiveUsers}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <UserList
                canEdit={canEdit}
                canDelete={canDelete}
                canCreate={canCreate}
              />
            </TabsContent>

            <TabsContent value="active" className="space-y-4">
              <UserList
                canEdit={canEdit}
                canDelete={canDelete}
                canCreate={canCreate}
              />
            </TabsContent>

            <TabsContent value="inactive" className="space-y-4">
              <UserList
                canEdit={canEdit}
                canDelete={canDelete}
                canCreate={canCreate}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {userRole !== "administrateur" && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-amber-100 p-2">
                <CrownIcon className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h3 className="font-medium text-amber-900">Accès restreint</h3>
                <p className="text-sm text-amber-700">
                  En tant que {userRole}, vous avez un accès{" "}
                  {userRole === "manager"
                    ? "de gestion limité"
                    : "en lecture seule"}{" "}
                  aux utilisateurs. Seuls les administrateurs peuvent créer,
                  modifier ou supprimer des utilisateurs.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
