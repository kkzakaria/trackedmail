"use client";

import { useState } from "react";
import { UserList } from "@/components/users/UserList";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CrownIcon } from "lucide-react";
import { useUsers } from "@/lib/hooks/use-users";

interface UsersPageClientProps {
  userRole: "administrateur" | "manager" | "utilisateur";
  currentUserId: string;
}

export function UsersPageClient({
  userRole,
  currentUserId,
}: UsersPageClientProps) {
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
      {/* Users Management */}
      <Card>
        <CardContent className="pt-6">
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
                currentUserId={currentUserId}
              />
            </TabsContent>

            <TabsContent value="active" className="space-y-4">
              <UserList
                canEdit={canEdit}
                canDelete={canDelete}
                canCreate={canCreate}
                currentUserId={currentUserId}
                filters={{ isActive: true }}
              />
            </TabsContent>

            <TabsContent value="inactive" className="space-y-4">
              <UserList
                canEdit={canEdit}
                canDelete={canDelete}
                canCreate={canCreate}
                currentUserId={currentUserId}
                filters={{ isActive: false }}
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
