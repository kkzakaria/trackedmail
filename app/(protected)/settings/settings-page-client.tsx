"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users, Mail, FileText, Code, Clock } from "lucide-react";

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
    <div className="bg-background min-h-screen">
      {/* Main Content */}
      <main className="mx-auto max-w-7xl py-2 sm:px-6 lg:px-8">
        <div className="px-4 py-2 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <p className="text-gray-600 dark:text-gray-300">
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
            <ScrollArea>
              <TabsList className="before:bg-border relative mb-3 h-auto w-full gap-0.5 bg-transparent p-0 before:absolute before:inset-x-0 before:bottom-0 before:h-px">
                {visibleTabs.users && (
                  <TabsTrigger
                    value="users"
                    className="bg-muted border-border gap-2 overflow-hidden rounded-b-none border-x border-t py-2 data-[state=active]:z-10 data-[state=active]:shadow-none"
                  >
                    <Users
                      className="-ms-0.5 me-1.5 h-4 w-4 opacity-60"
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">Utilisateurs</span>
                  </TabsTrigger>
                )}
                {visibleTabs.mailboxes && (
                  <TabsTrigger
                    value="mailboxes"
                    className="bg-muted border-border gap-2 overflow-hidden rounded-b-none border-x border-t py-2 data-[state=active]:z-10 data-[state=active]:shadow-none"
                  >
                    <Mail
                      className="-ms-0.5 me-1.5 h-4 w-4 opacity-60"
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">Boîtes aux lettres</span>
                  </TabsTrigger>
                )}
                {visibleTabs.templates && (
                  <TabsTrigger
                    value="templates"
                    className="bg-muted border-border gap-2 overflow-hidden rounded-b-none border-x border-t py-2 data-[state=active]:z-10 data-[state=active]:shadow-none"
                  >
                    <FileText
                      className="-ms-0.5 me-1.5 h-4 w-4 opacity-60"
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">Modèles de relance</span>
                  </TabsTrigger>
                )}
                {visibleTabs.settings && (
                  <TabsTrigger
                    value="settings"
                    className="bg-muted border-border gap-2 overflow-hidden rounded-b-none border-x border-t py-2 data-[state=active]:z-10 data-[state=active]:shadow-none"
                  >
                    <Clock
                      className="-ms-0.5 me-1.5 h-4 w-4 opacity-60"
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">Temps de relance</span>
                  </TabsTrigger>
                )}
                {visibleTabs.functions && (
                  <TabsTrigger
                    value="functions"
                    className="bg-muted border-border gap-2 overflow-hidden rounded-b-none border-x border-t py-2 data-[state=active]:z-10 data-[state=active]:shadow-none"
                  >
                    <Code
                      className="-ms-0.5 me-1.5 h-4 w-4 opacity-60"
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">Fonctions Edge</span>
                  </TabsTrigger>
                )}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

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
      </main>
    </div>
  );
}
