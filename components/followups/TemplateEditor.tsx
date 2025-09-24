"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Edit3,
  Save,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Hash,
  Type,
  FileText,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

import { VariableInserter } from "./VariableInserter";
import { TemplatePreview } from "./TemplatePreview";

interface TemplateData {
  id?: string;
  name: string;
  subject: string;
  body: string;
  followup_number: number;
  delay_hours: number;
  is_active: boolean;
}

interface TemplateEditorProps {
  initialData?: Partial<TemplateData> | null;
  onSave: (data: TemplateData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

export function TemplateEditor({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
  className,
}: TemplateEditorProps) {
  const [formData, setFormData] = useState<TemplateData>({
    name: "",
    subject: "",
    body: "",
    followup_number: 1,
    delay_hours: 4,
    is_active: true,
    ...initialData,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("editor");

  // Validation en temps réel
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Le nom du template est requis";
    }

    if (!formData.subject.trim()) {
      newErrors.subject = "Le sujet est requis";
    }

    if (!formData.body.trim()) {
      newErrors.body = "Le corps du message est requis";
    }

    if (formData.followup_number < 1 || formData.followup_number > 3) {
      newErrors.followup_number = "Le numéro de relance doit être entre 1 et 3";
    }

    if (formData.delay_hours < 1) {
      newErrors.delay_hours = "Le délai doit être d&apos;au moins 1 heure";
    }

    setErrors(newErrors);
  }, [formData]);

  const handleInputChange = (
    field: keyof TemplateData,
    value: string | number | boolean
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubjectInsert = (variable: string) => {
    const textarea = document.getElementById(
      "subject-input"
    ) as HTMLInputElement;
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const newValue =
      formData.subject.slice(0, start) + variable + formData.subject.slice(end);

    handleInputChange("subject", newValue);

    // Restaurer la position du curseur
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + variable.length,
        start + variable.length
      );
    }, 0);
  };

  const handleBodyInsert = (variable: string) => {
    const textarea = document.getElementById(
      "body-textarea"
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const newValue =
      formData.body.slice(0, start) + variable + formData.body.slice(end);

    handleInputChange("body", newValue);

    // Restaurer la position du curseur
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + variable.length,
        start + variable.length
      );
    }, 0);
  };

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) {
      toast.error("Veuillez corriger les erreurs avant de sauvegarder");
      return;
    }

    try {
      await onSave(formData);
      toast.success("Template sauvegardé avec succès");
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error("Save error:", error);
    }
  };

  const isValid = Object.keys(errors).length === 0;

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            {initialData?.id ? "Modifier le Template" : "Nouveau Template"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="editor" className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Éditeur
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Aperçu
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="mt-6 space-y-6">
              {/* Configuration générale */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="h-5 w-5" />
                    Configuration Générale
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">
                        <Type className="mr-1 inline h-4 w-4" />
                        Nom du Template
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={e =>
                          handleInputChange("name", e.target.value)
                        }
                        placeholder="Ex: Première relance commerciale"
                        className={errors.name ? "border-red-500" : ""}
                      />
                      {errors.name && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                          <AlertCircle className="h-3 w-3" />
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={checked =>
                          handleInputChange("is_active", checked)
                        }
                      />
                      <Label htmlFor="is_active">Template actif</Label>
                      {formData.is_active ? (
                        <Badge variant="default" className="ml-2">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-2">
                          Inactif
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="followup_number">
                        <Hash className="mr-1 inline h-4 w-4" />
                        Numéro de Relance
                      </Label>
                      <Select
                        value={formData.followup_number.toString()}
                        onValueChange={value =>
                          handleInputChange("followup_number", parseInt(value))
                        }
                      >
                        <SelectTrigger
                          className={
                            errors.followup_number ? "border-red-500" : ""
                          }
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1ère relance</SelectItem>
                          <SelectItem value="2">2ème relance</SelectItem>
                          <SelectItem value="3">
                            3ème relance (finale)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.followup_number && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                          <AlertCircle className="h-3 w-3" />
                          {errors.followup_number}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="delay_hours">
                        <Clock className="mr-1 inline h-4 w-4" />
                        Délai (heures après l&apos;email précédent)
                      </Label>
                      <Input
                        id="delay_hours"
                        type="number"
                        min="1"
                        max="168"
                        value={formData.delay_hours}
                        onChange={e =>
                          handleInputChange(
                            "delay_hours",
                            parseInt(e.target.value) || 1
                          )
                        }
                        className={errors.delay_hours ? "border-red-500" : ""}
                      />
                      {errors.delay_hours && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                          <AlertCircle className="h-3 w-3" />
                          {errors.delay_hours}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-1 text-xs">
                        Recommandé: 4h pour relance 1, 8h pour relance 2, 12h
                        pour relance 3
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Contenu du message */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" />
                    Contenu du Message
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label htmlFor="subject-input">Sujet</Label>
                      <VariableInserter onInsert={handleSubjectInsert} />
                    </div>
                    <Input
                      id="subject-input"
                      value={formData.subject}
                      onChange={e =>
                        handleInputChange("subject", e.target.value)
                      }
                      placeholder="Ex: Suivi - {{objet_original}}"
                      className={errors.subject ? "border-red-500" : ""}
                    />
                    {errors.subject && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        {errors.subject}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label htmlFor="body-textarea">Corps du Message</Label>
                      <VariableInserter onInsert={handleBodyInsert} />
                    </div>
                    <Textarea
                      id="body-textarea"
                      value={formData.body}
                      onChange={e => handleInputChange("body", e.target.value)}
                      placeholder="Bonjour {{destinataire_nom}},&#10;&#10;Je vous relance concernant {{objet_original}} envoyé le {{date_envoi_original}}.&#10;&#10;Cordialement,&#10;{{expediteur_nom}}"
                      rows={12}
                      className={errors.body ? "border-red-500" : ""}
                    />
                    {errors.body && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        {errors.body}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      Utilisez les variables pour personnaliser automatiquement
                      le contenu
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="mt-6">
              <TemplatePreview
                subject={formData.subject}
                body={formData.body}
              />
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-6">
            <div className="flex items-center gap-2">
              {isValid ? (
                <Badge
                  variant="default"
                  className="bg-green-100 text-green-700"
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Template valide
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  {Object.keys(errors).length} erreur(s)
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={!isValid || isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
