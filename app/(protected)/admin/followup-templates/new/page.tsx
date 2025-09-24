"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Plus,
  Wand2,
  FileText,
  Copy,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

import { TemplateEditor } from "@/components/followups/TemplateEditor";
import { FollowupTemplateService } from "@/lib/services/followup-template.service";

interface TemplateData {
  name: string;
  subject: string;
  body: string;
  followup_number: number;
  delay_hours: number;
  is_active: boolean;
}

interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  followup_number: number;
  delay_hours: number;
  subject: string;
  body: string;
  category: "commercial" | "service" | "administratif";
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: "commercial-1",
    name: "Première Relance Commerciale",
    description: "Relance douce pour une proposition commerciale",
    followup_number: 1,
    delay_hours: 4,
    category: "commercial",
    subject: "Suivi - {{objet_original}}",
    body: `Bonjour {{destinataire_nom}},

J'espère que vous allez bien.

Je me permets de revenir vers vous concernant {{objet_original}} que je vous ai envoyé le {{date_envoi_original}}.

Avez-vous eu l'occasion d'examiner notre proposition ? Je reste à votre disposition pour répondre à vos questions ou organiser un échange si cela vous intéresse.

Cordialement,
{{expediteur_nom}}`,
  },
  {
    id: "commercial-2",
    name: "Deuxième Relance Commerciale",
    description: "Relance plus insistante avec valeur ajoutée",
    followup_number: 2,
    delay_hours: 8,
    category: "commercial",
    subject: "Dernière chance - {{objet_original}}",
    body: `Bonjour {{destinataire_nom}},

Cela fait maintenant {{jours_depuis_envoi}} jours que je vous ai contacté concernant {{objet_original}}.

Je comprends que vous êtes probablement très occupé, mais je ne voudrais pas que cette opportunité vous échappe.

Puis-je vous proposer un appel de 15 minutes cette semaine pour vous présenter rapidement les bénéfices de notre solution ?

Dans l'attente de votre retour,
{{expediteur_nom}}`,
  },
  {
    id: "commercial-3",
    name: "Relance Finale Commerciale",
    description: "Dernière tentative avant clôture du dossier",
    followup_number: 3,
    delay_hours: 12,
    category: "commercial",
    subject: "Clôture du dossier - {{objet_original}}",
    body: `Bonjour {{destinataire_nom}},

N'ayant pas eu de retour de votre part concernant {{objet_original}}, j'en conclus que le moment n'est peut-être pas opportun pour {{destinataire_entreprise}}.

Je vais donc clôturer ce dossier, mais n'hésitez pas à me recontacter si la situation évolue.

Merci pour le temps que vous avez accordé à l'examen de notre proposition.

Cordialement,
{{expediteur_nom}}`,
  },
  {
    id: "service-1",
    name: "Première Relance Service Client",
    description: "Suivi d'une demande de support",
    followup_number: 1,
    delay_hours: 4,
    category: "service",
    subject: "Suivi de votre demande - {{objet_original}}",
    body: `Bonjour {{destinataire_nom}},

Je me permets de faire le point avec vous concernant {{objet_original}}.

Avez-vous pu avancer sur cette question ? Avez-vous besoin d'informations complémentaires de notre part ?

Je reste à votre disposition pour vous accompagner.

Cordialement,
{{expediteur_nom}}`,
  },
  {
    id: "administratif-1",
    name: "Première Relance Administrative",
    description: "Rappel pour des documents manquants",
    followup_number: 1,
    delay_hours: 4,
    category: "administratif",
    subject: "Rappel - {{objet_original}}",
    body: `Bonjour {{destinataire_nom}},

Je me permets de vous relancer concernant {{objet_original}} du {{date_envoi_original}}.

Pour finaliser votre dossier, nous aurions besoin de votre retour dans les meilleurs délais.

Merci par avance pour votre diligence.

Cordialement,
{{expediteur_nom}}`,
  },
];

const categoryLabels = {
  commercial: "Commercial",
  service: "Service Client",
  administratif: "Administratif",
};

const categoryColors = {
  commercial: "bg-blue-100 text-blue-800",
  service: "bg-green-100 text-green-800",
  administratif: "bg-purple-100 text-purple-800",
};

export default function NewTemplatePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("presets");
  const [selectedPreset, setSelectedPreset] = useState<PresetTemplate | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

  const templateService = new FollowupTemplateService();

  const handleSave = async (data: TemplateData) => {
    try {
      setIsSaving(true);
      const newTemplate = await templateService.createTemplate(data);
      toast.success("Template créé avec succès");
      router.push(`/admin/followup-templates/${newTemplate.id}`);
    } catch (err) {
      toast.error("Erreur lors de la création");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUsePreset = (preset: PresetTemplate) => {
    setSelectedPreset(preset);
    setActiveTab("editor");
  };

  const groupedPresets = PRESET_TEMPLATES.reduce(
    (acc, preset) => {
      if (!acc[preset.category]) {
        acc[preset.category] = [];
      }
      (acc[preset.category] as PresetTemplate[]).push(preset);
      return acc;
    },
    {} as Record<string, PresetTemplate[]>
  );

  if (activeTab === "editor") {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveTab("presets");
              setSelectedPreset(null);
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux Templates
          </Button>
          <h1 className="text-2xl font-bold">
            {selectedPreset
              ? `Nouveau Template: ${selectedPreset.name}`
              : "Nouveau Template Personnalisé"}
          </h1>
        </div>
        <TemplateEditor
          initialData={
            selectedPreset
              ? {
                  name: selectedPreset.name,
                  subject: selectedPreset.subject,
                  body: selectedPreset.body,
                  followup_number: selectedPreset.followup_number,
                  delay_hours: selectedPreset.delay_hours,
                  is_active: true,
                }
              : null
          }
          onSave={handleSave}
          onCancel={() => router.push("/admin/followup-templates")}
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
          <h1 className="text-2xl font-bold">Nouveau Template de Relance</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="presets" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Templates Prédéfinis
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Template Personnalisé
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Choisir un Template Prédéfini
              </CardTitle>
              <p className="text-muted-foreground">
                Démarrez rapidement avec nos templates testés et optimisés. Vous
                pourrez les personnaliser après sélection.
              </p>
            </CardHeader>
            <CardContent>
              {Object.entries(groupedPresets).map(([category, presets]) => (
                <div key={category} className="mb-8">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <Badge
                      className={
                        categoryColors[category as keyof typeof categoryColors]
                      }
                    >
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </Badge>
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {presets.map(preset => (
                      <Card
                        key={preset.id}
                        className="cursor-pointer transition-shadow hover:shadow-md"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base">
                              {preset.name}
                            </CardTitle>
                            <div className="flex gap-1">
                              <Badge variant="outline" className="text-xs">
                                #{preset.followup_number}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {preset.delay_hours}h
                              </Badge>
                            </div>
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {preset.description}
                          </p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            <div>
                              <h5 className="text-muted-foreground mb-1 text-xs font-medium">
                                SUJET
                              </h5>
                              <p className="bg-muted text-muted-foreground rounded p-2 font-mono text-sm">
                                {preset.subject}
                              </p>
                            </div>
                            <div>
                              <h5 className="text-muted-foreground mb-1 text-xs font-medium">
                                APERÇU
                              </h5>
                              <p className="text-muted-foreground line-clamp-3 text-xs">
                                {preset.body.split("\n")[0]}...
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleUsePreset(preset)}
                            >
                              <Copy className="mr-2 h-3 w-3" />
                              Utiliser ce Template
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Template Personnalisé
              </CardTitle>
              <p className="text-muted-foreground">
                Créez un template entièrement personnalisé selon vos besoins
                spécifiques.
              </p>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setActiveTab("editor")}
                size="lg"
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Créer un Template Vierge
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
