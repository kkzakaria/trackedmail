"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  PlayIcon,
  SettingsIcon,
  LoaderIcon,
  CheckCircleIcon,
  XCircleIcon,
  InfoIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface EdgeFunction {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "inactive" | "error";
  lastExecution?: Date;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: unknown;
    options?: string[];
  }>;
}

interface Mailbox {
  id: string;
  email_address: string;
  is_active: boolean;
}

interface FunctionExecutorProps {
  functions: EdgeFunction[];
  selectedFunction: string | null;
  onSelectFunction: (functionId: string) => void;
  availableMailboxes: Mailbox[];
}

interface ExecutionResult {
  success: boolean;
  stats?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  error?: string;
  message?: string;
  executedAt: Date;
}

export function FunctionExecutor({
  functions,
  selectedFunction,
  onSelectFunction,
  availableMailboxes,
}: FunctionExecutorProps) {
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const selectedFunc = functions.find(f => f.id === selectedFunction);
  const supabase = createClient();

  const handleParameterChange = (paramName: string, value: unknown) => {
    setParameters(prev => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const executeFunction = async () => {
    if (!selectedFunc) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      // Construct the API call based on function type
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${selectedFunc.id}`;

      // Get current session for authorization
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Session non disponible");
      }

      // Prepare parameters based on function
      const body: Record<string, unknown> = { ...parameters };

      // Special handling for datetime-local inputs
      selectedFunc.parameters.forEach(param => {
        if (param.type === "datetime-local" && parameters[param.name]) {
          const value = parameters[param.name];
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            value instanceof Date
          ) {
            body[param.name] = new Date(value).toISOString();
          }
        }
      });

      // Make the API call
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      const executionResult: ExecutionResult = {
        success: response.ok,
        executedAt: new Date(),
      };

      if (response.ok) {
        executionResult.stats = result.stats;
        executionResult.parameters = result.parameters;
      } else {
        executionResult.error = result.error || "Erreur inconnue";
        executionResult.message = result.message;
      }

      setExecutionResult(executionResult);
      setShowResult(true);
    } catch (error) {
      console.error("Execution error:", error);
      setExecutionResult({
        success: false,
        error: "Erreur de communication",
        message: error instanceof Error ? error.message : "Erreur inconnue",
        executedAt: new Date(),
      });
      setShowResult(true);
    } finally {
      setIsExecuting(false);
    }
  };

  const renderParameterInput = (param: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: unknown;
    options?: string[];
  }) => {
    const value = parameters[param.name] ?? param.default ?? undefined;

    switch (param.type) {
      case "datetime-local":
        return (
          <Input
            type="datetime-local"
            value={typeof value === "string" ? value : ""}
            onChange={e => handleParameterChange(param.name, e.target.value)}
          />
        );

      case "boolean":
        return (
          <Switch
            checked={typeof value === "boolean" ? value : false}
            onCheckedChange={checked =>
              handleParameterChange(param.name, checked)
            }
          />
        );

      case "select":
        return (
          <Select
            value={typeof value === "string" ? value : ""}
            onValueChange={val => handleParameterChange(param.name, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une option" />
            </SelectTrigger>
            <SelectContent>
              {param.options?.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multiselect":
        if (param.name === "mailboxIds") {
          const arrayValue = Array.isArray(value) ? value : [];
          return (
            <Select
              value={arrayValue[0] || ""}
              onValueChange={val =>
                handleParameterChange(param.name, val ? [val] : [])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une mailbox" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes les mailboxes</SelectItem>
                {availableMailboxes.map(mailbox => (
                  <SelectItem key={mailbox.id} value={mailbox.id}>
                    {mailbox.email_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return (
          <Input
            value={
              Array.isArray(value)
                ? value.join(", ")
                : typeof value === "string"
                  ? value
                  : ""
            }
            onChange={e => {
              const vals = e.target.value
                .split(",")
                .map(v => v.trim())
                .filter(Boolean);
              handleParameterChange(param.name, vals);
            }}
            placeholder="Valeurs séparées par des virgules"
          />
        );

      default:
        return (
          <Input
            value={
              typeof value === "string" || typeof value === "number"
                ? String(value)
                : ""
            }
            onChange={e => handleParameterChange(param.name, e.target.value)}
            placeholder={`Entrez ${param.description.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Function Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Exécution de fonctions
          </CardTitle>
          <CardDescription>
            Sélectionnez une fonction et configurez ses paramètres pour
            l&apos;exécuter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Fonction à exécuter</Label>
              <Select
                value={selectedFunction || ""}
                onValueChange={onSelectFunction}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une fonction" />
                </SelectTrigger>
                <SelectContent>
                  {functions.map(func => (
                    <SelectItem key={func.id} value={func.id}>
                      <div className="flex items-center gap-2">
                        {func.name}
                        <Badge variant="outline" className="text-xs">
                          {func.category}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Function Configuration */}
      {selectedFunc && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedFunc.name}</CardTitle>
            <CardDescription>{selectedFunc.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedFunc.parameters.length > 0 ? (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Paramètres</h4>

                {selectedFunc.parameters.map(param => (
                  <div key={param.name} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={param.name}>{param.name}</Label>
                      {param.required && (
                        <Badge variant="destructive" className="text-xs">
                          Requis
                        </Badge>
                      )}
                      {param.default !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          Défaut: {String(param.default)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {param.description}
                    </p>
                    {renderParameterInput(param)}
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Aucun paramètre requis</AlertTitle>
                <AlertDescription>
                  Cette fonction peut être exécutée directement sans
                  configuration.
                </AlertDescription>
              </Alert>
            )}

            {/* Execute Button */}
            <Separator />
            <div className="flex justify-end">
              <Button
                onClick={executeFunction}
                disabled={isExecuting || selectedFunc.status !== "active"}
                className="min-w-32"
              >
                {isExecuting ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Exécution...
                  </>
                ) : (
                  <>
                    <PlayIcon className="mr-2 h-4 w-4" />
                    Exécuter
                  </>
                )}
              </Button>
            </div>

            {/* Execution Progress */}
            {isExecuting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Exécution en cours...</span>
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Execution Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {executionResult?.success ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-600" />
              )}
              Résultat d&apos;exécution
            </DialogTitle>
            <DialogDescription>
              {selectedFunc?.name} • Exécuté{" "}
              {executionResult &&
                formatDistanceToNow(executionResult.executedAt, {
                  addSuffix: true,
                  locale: fr,
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {executionResult?.success ? (
              <Alert>
                <CheckCircleIcon className="h-4 w-4" />
                <AlertTitle>Exécution réussie</AlertTitle>
                <AlertDescription>
                  La fonction a été exécutée avec succès.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <XCircleIcon className="h-4 w-4" />
                <AlertTitle>Échec d&apos;exécution</AlertTitle>
                <AlertDescription>
                  {executionResult?.error} - {executionResult?.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Detailed Results */}
            {executionResult?.stats && (
              <div className="space-y-4">
                <h4 className="font-semibold">Statistiques</h4>
                <ScrollArea className="h-64 w-full rounded-md border p-4">
                  <pre className="text-sm">
                    {JSON.stringify(executionResult.stats, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}

            {executionResult?.parameters && (
              <div className="space-y-4">
                <h4 className="font-semibold">Paramètres utilisés</h4>
                <ScrollArea className="h-32 w-full rounded-md border p-4">
                  <pre className="text-sm">
                    {JSON.stringify(executionResult.parameters, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
