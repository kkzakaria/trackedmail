"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ServerIcon, PlayIcon, FileTextIcon, TestTubeIcon } from "lucide-react";
import { FunctionCard } from "./components/function-card";
import { FunctionExecutor } from "./components/function-executor";

interface Mailbox {
  id: string;
  email_address: string;
  is_active: boolean;
}

interface FunctionsPageClientProps {
  userRole: "administrateur" | "manager" | "utilisateur";
  currentUserId: string;
  availableMailboxes: Mailbox[];
}

// Configuration des fonctions Edge
const edgeFunctions = [
  {
    id: "mailbox-email-processor",
    name: "Mailbox Email Processor",
    description:
      "Traite les emails des mailboxes actives sur une période donnée",
    category: "Traitement",
    status: "active" as const,
    lastExecution: new Date("2024-09-25T10:30:00Z"),
    parameters: [
      {
        name: "startDate",
        type: "datetime-local",
        required: true,
        description: "Date de début",
      },
      {
        name: "endDate",
        type: "datetime-local",
        required: true,
        description: "Date de fin",
      },
      {
        name: "mailboxIds",
        type: "multiselect",
        required: false,
        description: "Mailboxes spécifiques",
      },
      {
        name: "processResponses",
        type: "boolean",
        required: false,
        default: true,
        description: "Traiter les réponses",
      },
      {
        name: "dryRun",
        type: "boolean",
        required: false,
        default: false,
        description: "Mode test (sans insertion)",
      },
      {
        name: "requireSpecificMailboxes",
        type: "boolean",
        required: false,
        default: false,
        description: "Exiger des mailboxes spécifiques",
      },
    ],
  },
  {
    id: "microsoft-webhook",
    name: "Microsoft Webhook Handler",
    description:
      "Gère les webhooks Microsoft Graph pour la détection de réponses",
    category: "Intégration",
    status: "active" as const,
    lastExecution: new Date("2024-09-25T12:15:00Z"),
    parameters: [],
  },
  {
    id: "microsoft-auth",
    name: "Microsoft Authentication",
    description: "Gère l'authentification avec Microsoft Graph API",
    category: "Authentification",
    status: "active" as const,
    lastExecution: new Date("2024-09-25T11:45:00Z"),
    parameters: [
      {
        name: "action",
        type: "select",
        required: true,
        options: ["acquire", "refresh"],
        description: "Action à effectuer",
      },
    ],
  },
  {
    id: "followup-scheduler",
    name: "Followup Scheduler",
    description: "Planifie les relances automatiques selon la configuration",
    category: "Relances",
    status: "active" as const,
    lastExecution: new Date("2024-09-25T09:00:00Z"),
    parameters: [],
  },
  {
    id: "followup-sender",
    name: "Followup Sender",
    description: "Envoie les relances programmées aux destinataires",
    category: "Relances",
    status: "active" as const,
    lastExecution: new Date("2024-09-25T09:30:00Z"),
    parameters: [],
  },
  {
    id: "microsoft-subscriptions",
    name: "Microsoft Subscriptions Manager",
    description: "Gère les abonnements Microsoft Graph pour les webhooks",
    category: "Intégration",
    status: "active" as const,
    lastExecution: new Date("2024-09-25T08:00:00Z"),
    parameters: [
      {
        name: "action",
        type: "select",
        required: true,
        options: ["create", "renew", "delete"],
        description: "Action sur l'abonnement",
      },
      {
        name: "mailboxId",
        type: "select",
        required: false,
        description: "Mailbox concernée",
      },
    ],
  },
];

export function FunctionsPageClient({
  availableMailboxes,
}: FunctionsPageClientProps) {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);

  const categories = Array.from(new Set(edgeFunctions.map(f => f.category)));

  return (
    <div className="space-y-6">
      {/* Main Content */}
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <ServerIcon className="h-4 w-4" />
            Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger value="execute" className="flex items-center gap-2">
            <PlayIcon className="h-4 w-4" />
            Exécution
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileTextIcon className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="tests" className="flex items-center gap-2">
            <TestTubeIcon className="h-4 w-4" />
            Tests
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div>
            {/* Functions by Category */}
            {categories.map(category => {
              const categoryFunctions = edgeFunctions.filter(
                f => f.category === category
              );

              return (
                <div key={category} className="mb-8">
                  <div className="mb-4 flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{category}</h3>
                    <Badge variant="outline">{categoryFunctions.length}</Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categoryFunctions.map(func => (
                      <FunctionCard
                        key={func.id}
                        function={func}
                        onExecute={() => {
                          setSelectedFunction(func.id);
                          setSelectedTab("execute");
                        }}
                        onViewLogs={() => {
                          setSelectedFunction(func.id);
                          setSelectedTab("logs");
                        }}
                      />
                    ))}
                  </div>

                  {category !== categories[categories.length - 1] && (
                    <Separator className="mt-8" />
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Execute Tab */}
        <TabsContent value="execute" className="space-y-6">
          <FunctionExecutor
            functions={edgeFunctions}
            selectedFunction={selectedFunction}
            onSelectFunction={setSelectedFunction}
            availableMailboxes={availableMailboxes}
          />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Logs des fonctions</CardTitle>
              <CardDescription>
                Consultez les logs d&apos;exécution et les erreurs des fonctions
                Edge.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground py-8 text-center">
                <FileTextIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>
                  Interface de consultation des logs en cours de développement
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tests automatisés</CardTitle>
              <CardDescription>
                Exécutez des tests prédéfinis pour valider le bon fonctionnement
                des fonctions Edge.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground py-8 text-center">
                <TestTubeIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>Interface de tests automatisés en cours de développement</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
