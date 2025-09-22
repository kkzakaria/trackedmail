'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useCreateMailbox, useUpdateMailbox } from '@/lib/hooks/use-mailboxes';
import { createMailboxSchema } from '@/lib/schemas/mailbox.schema';
import type { Tables } from '@/lib/types/database.types';
import { Loader2 } from 'lucide-react';

interface MailboxFormProps {
  initialData?: Tables<'mailboxes'>;
  onSuccess?: (mailbox: Tables<'mailboxes'>) => void;
  onCancel?: () => void;
}

export function MailboxForm({ initialData, onSuccess, onCancel }: MailboxFormProps) {
  const isEditing = !!initialData;
  const createMailboxMutation = useCreateMailbox();
  const updateMailboxMutation = useUpdateMailbox();

  const form = useForm({
    resolver: zodResolver(createMailboxSchema),
    defaultValues: {
      email_address: initialData?.email_address || '',
      display_name: initialData?.display_name || '',
      microsoft_user_id: initialData?.microsoft_user_id || '',
      is_active: initialData?.is_active ?? true,
    },
  });

  const onSubmit = async (data: any) => {
    try {
      let result;

      if (isEditing) {
        result = await updateMailboxMutation.mutateAsync({
          id: initialData!.id,
          updates: data,
        });
      } else {
        result = await createMailboxMutation.mutateAsync(data);
      }

      onSuccess?.(result);
    } catch (error: any) {
      // Handle validation errors from the server
      if (error.message) {
        form.setError('root', { message: error.message });
      }
    }
  };

  const isPending = createMailboxMutation.isPending || updateMailboxMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? 'Modifier la boîte mail' : 'Nouvelle boîte mail'}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? 'Modifiez les informations de la boîte mail.'
            : 'Ajoutez une nouvelle boîte mail à suivre.'
          }
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
                    <Input
                      placeholder="user@company.com"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    L'adresse email de la boîte mail Microsoft à suivre.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Display Name Field */}
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom d'affichage</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nom de l'utilisateur"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Nom d'affichage pour identifier facilement la boîte mail.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Microsoft User ID Field */}
            <FormField
              control={form.control}
              name="microsoft_user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID utilisateur Microsoft</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    ID utilisateur Microsoft Graph (optionnel, sera récupéré automatiquement).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      Les boîtes mail actives sont surveillées pour les nouveaux emails.
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
              <div className="rounded-lg border border-destructive/50 p-4">
                <p className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Mettre à jour' : 'Créer la boîte mail'}
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
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium text-sm mb-2">💡 Conseils</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• L'adresse email doit être valide et accessible via Microsoft Graph</li>
                <li>• Le nom d'affichage aide à identifier rapidement la boîte mail</li>
                <li>• Les boîtes mail inactives ne seront pas surveillées</li>
              </ul>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}