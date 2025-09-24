"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCreateMailbox, useUpdateMailbox } from "@/lib/hooks/use-mailboxes";
import { createMailboxSchema } from "@/lib/schemas/mailbox.schema";
import * as z from "zod";
import type { Tables } from "@/lib/types/database.types";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { debounce } from "lodash";

interface MailboxFormProps {
  initialData?: Tables<"mailboxes">;
  onSuccess?: (mailbox: Tables<"mailboxes">) => void;
  onCancel?: () => void;
}

type ValidationState = "idle" | "validating" | "valid" | "invalid";

interface ValidationResult {
  microsoft_user_id?: string;
  display_name?: string;
  email_address?: string;
  job_title?: string;
  department?: string;
}

export function MailboxForm({
  initialData,
  onSuccess,
  onCancel,
}: MailboxFormProps) {
  const isEditing = !!initialData;
  const createMailboxMutation = useCreateMailbox();
  const updateMailboxMutation = useUpdateMailbox();
  const [validationState, setValidationState] =
    useState<ValidationState>("idle");
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(createMailboxSchema),
    defaultValues: {
      email_address: initialData?.email_address || "",
      display_name: initialData?.display_name || "",
      is_active: initialData?.is_active ?? true,
    },
  });

  // Fonction de validation de l'email via l'API
  const validateEmail = useCallback(
    async (email: string) => {
      if (!email?.includes("@")) {
        setValidationState("idle");
        setValidationResult(null);
        setValidationError(null);
        return;
      }

      setValidationState("validating");
      setValidationError(null);

      try {
        const response = await fetch("/api/mailboxes/validate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setValidationState("valid");
          setValidationResult(data.data);

          // Auto-remplir le display_name si vide
          if (data.data.display_name && !form.getValues("display_name")) {
            form.setValue("display_name", data.data.display_name);
          }
        } else {
          setValidationState("invalid");
          setValidationError(data.error || "Email non valide");
        }
      } catch {
        setValidationState("invalid");
        setValidationError("Erreur lors de la validation");
      }
    },
    [form]
  );

  // Debounced version de la fonction de validation
  const debouncedValidateEmail = useMemo(
    () => debounce(validateEmail, 500),
    [validateEmail]
  );

  const onSubmit = async (data: z.infer<typeof createMailboxSchema>) => {
    try {
      let result;

      // Convert and clean data for database compatibility
      const dbData = {
        email_address: data.email_address,
        display_name: data.display_name?.trim() || null,
        is_active: data.is_active ?? true,
      };

      if (isEditing) {
        result = await updateMailboxMutation.mutateAsync({
          id: initialData?.id || "",
          updates: dbData,
        });
      } else {
        result = await createMailboxMutation.mutateAsync(dbData);
      }

      onSuccess?.(result);
    } catch (error: unknown) {
      // Handle validation errors from the server
      if (error instanceof Error && error.message) {
        form.setError("root", { message: error.message });
      }
    }
  };

  const isPending =
    createMailboxMutation.isPending || updateMailboxMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? "Modifier la boîte mail" : "Nouvelle boîte mail"}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? "Modifiez les informations de la boîte mail."
            : "Ajoutez une nouvelle boîte mail à suivre."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Address Field */}
            <FormField
              control={form.control}
              name="email_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse email *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="user@company.com"
                        {...field}
                        onChange={e => {
                          field.onChange(e);
                          if (!isEditing) {
                            debouncedValidateEmail(e.target.value);
                          }
                        }}
                        disabled={isPending || isEditing}
                      />
                      {validationState === "validating" && (
                        <Loader2 className="text-muted-foreground absolute top-3 right-3 h-4 w-4 animate-spin" />
                      )}
                      {validationState === "valid" && (
                        <CheckCircle className="absolute top-3 right-3 h-4 w-4 text-green-600" />
                      )}
                      {validationState === "invalid" && (
                        <AlertCircle className="text-destructive absolute top-3 right-3 h-4 w-4" />
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    L&apos;adresse email de la boîte mail Microsoft à suivre.
                  </FormDescription>
                  <FormMessage />
                  {validationError && (
                    <p className="text-destructive mt-1 text-sm">
                      {validationError}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Display Name Field */}
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom d&apos;affichage</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nom de l'utilisateur"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Nom d&apos;affichage pour identifier facilement la boîte
                    mail.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Afficher les informations Microsoft si validées */}
            {validationState === "valid" && validationResult && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Email validé avec succès !</p>
                    <p className="text-muted-foreground text-sm">
                      Microsoft ID:{" "}
                      <code className="text-xs">
                        {validationResult.microsoft_user_id}
                      </code>
                    </p>
                    {validationResult.job_title && (
                      <p className="text-muted-foreground text-sm">
                        Fonction: {validationResult.job_title}
                      </p>
                    )}
                    {validationResult.department && (
                      <p className="text-muted-foreground text-sm">
                        Département: {validationResult.department}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Active Status Switch */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Boîte mail active
                    </FormLabel>
                    <FormDescription>
                      Les boîtes mail actives sont surveillées pour les nouveaux
                      emails.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Error message */}
            {form.formState.errors.root && (
              <div className="border-destructive/50 rounded-lg border p-4">
                <p className="text-destructive text-sm">
                  {form.formState.errors.root.message}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                disabled={
                  isPending || (!isEditing && validationState !== "valid")
                }
                className="flex items-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? "Mettre à jour" : "Créer la boîte mail"}
              </Button>

              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isPending}
                >
                  Annuler
                </Button>
              )}
            </div>

            {/* Help text */}
            <div className="bg-muted rounded-lg p-4">
              <h4 className="mb-2 text-sm font-medium">💡 Conseils</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>
                  • L&apos;adresse email doit exister dans votre tenant
                  Microsoft
                </li>
                <li>
                  • La validation vérifie l&apos;existence et récupère les infos
                  Microsoft
                </li>
                <li>
                  • Le nom d&apos;affichage sera auto-complété depuis Microsoft
                  (modifiable)
                </li>
                <li>• Les boîtes mail inactives ne seront pas surveillées</li>
              </ul>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
