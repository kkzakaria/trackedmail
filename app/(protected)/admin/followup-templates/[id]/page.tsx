"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Copy,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { TemplateEditor } from "@/components/followups/TemplateEditor";
import { FollowupTemplateService } from "@/lib/services/followup-template.service";

interface TemplateData {
  id: string;
  name: string;
  subject: string;
  body: string;
  followup_number: number;
  delay_hours: number | null;
  is_active: boolean | null;
  version: number | null;
  created_at: string | null;
  updated_at: string | null;
  created_by?: string | null;
  available_variables: string[] | null;
}

interface TemplateStats {
  total_sent: number;
  success_rate: number;
  last_used: string | null;
}

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const templateService = useMemo(() => new FollowupTemplateService(), []);

  const loadTemplate = useCallback(async () => {
    if (!templateId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [templateData, statsData] = await Promise.all([
        templateService.getTemplateById(templateId),
        templateService.getTemplateStats(templateId),
      ]);

      if (!templateData) {
        setError("Template non trouvé");
        return;
      }

      setTemplate(templateData);
      setStats(statsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors du chargement"
      );
    } finally {
      setIsLoading(false);
    }
  }, [templateId, templateService]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const handleSave = async (data: {
    name: string;
    subject: string;
    body: string;
    followup_number: number;
    delay_hours: number;
    is_active: boolean;
  }) => {
    if (!template) return;

    try {
      setIsSaving(true);
      const updatedTemplate = await templateService.updateTemplate(
        template.id,
        data
      );
      setTemplate(updatedTemplate);
      setShowEditor(false);
      toast.success("Template mis à jour avec succès");
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!template) return;

    try {
      const duplicatedTemplate = await templateService.duplicateTemplate(
        template.id
      );
      toast.success("Template dupliqué avec succès");
      router.push(`/admin/followup-templates/${duplicatedTemplate.id}`);
    } catch (err) {
      toast.error("Erreur lors de la duplication");
      console.error("Duplicate error:", err);
    }
  };

  const handleDelete = async () => {
    if (!template) return;

    try {
      setIsDeleting(true);
      await templateService.deleteTemplate(template.id);
      toast.success("Template supprimé avec succès");
      router.push("/admin/followup-templates");
    } catch (err) {
      toast.error("Erreur lors de la suppression");
      console.error("Delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!template) return;

    try {
      const updatedTemplate = await templateService.updateTemplate(
        template.id,
        {
          is_active: !template.is_active,
        }
      );
      setTemplate(updatedTemplate);
      toast.success(
        `Template ${updatedTemplate.is_active ? "activé" : "désactivé"} avec succès`
      );
    } catch (err) {
      toast.error("Erreur lors de la modification du statut");
      console.error("Toggle error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full" />
          </div>
          <div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/followup-templates")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux Templates
          </Button>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || "Template non trouvé"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (showEditor) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEditor(false)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux Détails
          </Button>
          <h1 className="text-2xl font-bold">Modifier le Template</h1>
        </div>
        <TemplateEditor
          initialData={
            template
              ? {
                  id: template.id,
                  name: template.name,
                  subject: template.subject,
                  body: template.body,
                  followup_number: template.followup_number,
                  delay_hours: template.delay_hours || 4,
                  is_active: template.is_active || false,
                }
              : null
          }
          onSave={handleSave}
          onCancel={() => setShowEditor(false)}
          isLoading={isSaving}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/followup-templates")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux Templates
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{template.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={template.is_active ? "default" : "secondary"}>
                {template.is_active ? (
                  <>
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Actif
                  </>
                ) : (
                  "Inactif"
                )}
              </Badge>
              <Badge variant="outline">
                Relance #{template.followup_number}
              </Badge>
              <Badge variant="outline">
                <Clock className="mr-1 h-3 w-3" />
                {template.delay_hours || 0}h
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Dupliquer
          </Button>
          <Button variant="outline" size="sm" onClick={handleToggleActive}>
            {template.is_active ? "Désactiver" : "Activer"}
          </Button>
          <Button size="sm" onClick={() => setShowEditor(true)}>
            <Edit3 className="mr-2 h-4 w-4" />
            Modifier
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Contenu principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Aperçu du template */}
          <Card>
            <CardHeader>
              <CardTitle>Aperçu du Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="mb-2 font-medium">Sujet</h4>
                <div className="bg-muted rounded-md p-3">
                  <code className="text-sm">{template.subject}</code>
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-medium">Corps du Message</h4>
                <div className="bg-muted rounded-md p-3">
                  <pre className="text-sm whitespace-pre-wrap">
                    {template.body}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variables utilisées */}
          <Card>
            <CardHeader>
              <CardTitle>Variables Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(template.available_variables || []).map(variable => (
                  <Badge key={variable} variant="outline" className="font-mono">
                    {`{{${variable}}}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Statistiques */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Statistiques d&apos;Utilisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total envoyé</span>
                  <span className="font-medium">{stats.total_sent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taux de succès</span>
                  <span className="font-medium">{stats.success_rate}%</span>
                </div>
                {stats.last_used && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Dernière utilisation
                    </span>
                    <span className="font-medium">
                      {new Date(stats.last_used).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Informations */}
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">v{template.version || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créé le</span>
                <span className="font-medium">
                  {template.created_at
                    ? new Date(template.created_at).toLocaleDateString("fr-FR")
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modifié le</span>
                <span className="font-medium">
                  {template.updated_at
                    ? new Date(template.updated_at).toLocaleDateString("fr-FR")
                    : "N/A"}
                </span>
              </div>
              {template.created_by && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créé par</span>
                  <span className="flex items-center gap-1 font-medium">
                    <User className="h-3 w-3" />
                    {template.created_by}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions dangereuses */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-700">
                Actions Dangereuses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer le Template
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer le Template</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr de vouloir supprimer ce template ? Cette
                      action est irréversible et toutes les relances programmées
                      utilisant ce template seront annulées.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Suppression..." : "Supprimer"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
