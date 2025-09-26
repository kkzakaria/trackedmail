"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Mail, FileText, Code, Shield, Clock } from "lucide-react";

// Import existing client components
import { UsersPageClient } from "../admin/users/users-page-client";
import { MailboxesPageClient } from "../admin/mailboxes/mailboxes-page-client";
import { FollowupTemplatesPageClient } from "../admin/followup-templates/followup-templates-page-client";
import { FollowupSettingsPageClient } from "../admin/settings/followups/followup-settings-page-client";
import { FunctionsPageClient } from "../admin/functions/functions-page-client";
import { FollowupTemplateWithStats } from "@/lib/types/followup.types";

interface SettingsPageClientProps {
  userRole: "administrateur" | "manager" | "utilisateur";
  currentUserId: string;
  visibleTabs: {
    users: boolean;
    mailboxes: boolean;
    templates: boolean;
    settings: boolean;
    functions: boolean;
  };
  availableMailboxes: {
    id: string;
    email_address: string;
    is_active: boolean;
  }[];
  initialTemplates: FollowupTemplateWithStats[];
}

export function SettingsPageClient({
  userRole,
  currentUserId,
  visibleTabs,
  availableMailboxes,
  initialTemplates,
}: SettingsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("users");

  // Initialize tab from URL query params
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && Object.keys(visibleTabs).includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, visibleTabs]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`/settings?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Shield className="h-8 w-8" />
          Configuration du système
        </h1>
        <p className="text-muted-foreground mt-2">
          Gérez tous les paramètres et configurations de TrackedMail depuis
          cette interface unifiée.
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-5 lg:inline-flex lg:w-auto">
          {visibleTabs.users && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Utilisateurs</span>
            </TabsTrigger>
          )}
          {visibleTabs.mailboxes && (
            <TabsTrigger value="mailboxes" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Boîtes aux lettres</span>
            </TabsTrigger>
          )}
          {visibleTabs.templates && (
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Modèles de relance</span>
            </TabsTrigger>
          )}
          {visibleTabs.settings && (
            <TabsTrigger value="settings" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Temps de relance</span>
            </TabsTrigger>
          )}
          {visibleTabs.functions && (
            <TabsTrigger value="functions" className="gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Fonctions Edge</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab Contents */}
        {visibleTabs.users && (
          <TabsContent value="users" className="mt-6">
            <UsersPageClient
              userRole={userRole}
              currentUserId={currentUserId}
            />
          </TabsContent>
        )}

        {visibleTabs.mailboxes && (
          <TabsContent value="mailboxes" className="mt-6">
            <MailboxesPageClient />
          </TabsContent>
        )}

        {visibleTabs.templates && (
          <TabsContent value="templates" className="mt-6">
            <FollowupTemplatesPageClient initialData={initialTemplates} />
          </TabsContent>
        )}

        {visibleTabs.settings && (
          <TabsContent value="settings" className="mt-6">
            <FollowupSettingsPageClient />
          </TabsContent>
        )}

        {visibleTabs.functions && (
          <TabsContent value="functions" className="mt-6">
            <FunctionsPageClient
              userRole={userRole}
              currentUserId={currentUserId}
              availableMailboxes={availableMailboxes}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
