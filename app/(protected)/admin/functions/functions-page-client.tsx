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
import {
  ServerIcon,
  PlayIcon,
  SettingsIcon,
  FileTextIcon,
  TestTubeIcon,
  ClockIcon,
  CheckCircleIcon,
} from "lucide-react";
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

  const totalFunctions = edgeFunctions.length;
  const activeFunctions = edgeFunctions.filter(
    f => f.status === "active"
  ).length;
  const categories = Array.from(new Set(edgeFunctions.map(f => f.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <ServerIcon className="h-8 w-8" />
          Gestion des fonctions Edge
        </h1>
        <p className="text-muted-foreground">
          Administrez et surveillez les fonctions Supabase Edge pour le
          traitement des emails et intégrations.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Fonctions
            </CardTitle>
            <ServerIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFunctions}</div>
            <p className="text-muted-foreground text-xs">
              Fonctions Edge déployées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fonctions Actives
            </CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeFunctions}
            </div>
            <p className="text-muted-foreground text-xs">En fonctionnement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Catégories</CardTitle>
            <SettingsIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-muted-foreground text-xs">Types de fonctions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mailboxes Actives
            </CardTitle>
            <ClockIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {availableMailboxes.length}
            </div>
            <p className="text-muted-foreground text-xs">
              Disponibles pour traitement
            </p>
          </CardContent>
        </Card>
      </div>

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
            <h2 className="mb-4 text-2xl font-bold">Fonctions disponibles</h2>

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
