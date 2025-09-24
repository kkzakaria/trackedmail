"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Smartphone, Monitor, Download, Copy, Mail } from "lucide-react";
import { toast } from "sonner";

interface TemplatePreviewProps {
  subject: string;
  body: string;
  className?: string;
}

// Données de test pour le rendu des variables
const TEST_DATA = {
  destinataire_nom: "Jean Dupont",
  destinataire_entreprise: "Entreprise ABC",
  objet_original: "Proposition de collaboration Q4 2025",
  date_envoi_original: "15/09/2025",
  numero_relance: "2",
  jours_depuis_envoi: "5",
  expediteur_nom: "Marie Martin",
  expediteur_email: "marie.martin@trackedmail.com",
};

export function TemplatePreview({
  subject,
  body,
  className,
}: TemplatePreviewProps) {
  // Rendu du template avec les données de test
  const renderedContent = useMemo(() => {
    let renderedSubject = subject;
    let renderedBody = body;

    Object.entries(TEST_DATA).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      renderedSubject = renderedSubject.replace(regex, value);
      renderedBody = renderedBody.replace(regex, value);
    });

    return { subject: renderedSubject, body: renderedBody };
  }, [subject, body]);

  // Convertir les retours à la ligne en HTML
  const htmlBody = renderedContent.body
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");

  const handleCopyToClipboard = (content: string, type: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`${type} copié dans le presse-papiers`);
  };

  const handleExportHtml = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${renderedContent.subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        p { margin-bottom: 15px; }
    </style>
</head>
<body>
    <h1>${renderedContent.subject}</h1>
    <div>${htmlBody}</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-preview-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Template exporté en HTML");
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Aperçu du Template
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleCopyToClipboard(renderedContent.subject, "Sujet")
                }
              >
                <Copy className="mr-1 h-4 w-4" />
                Copier Sujet
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleCopyToClipboard(renderedContent.body, "Corps")
                }
              >
                <Copy className="mr-1 h-4 w-4" />
                Copier Corps
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportHtml}>
                <Download className="mr-1 h-4 w-4" />
                Exporter HTML
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="desktop" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="desktop" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Desktop
              </TabsTrigger>
              <TabsTrigger value="mobile" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile
              </TabsTrigger>
            </TabsList>

            <TabsContent value="desktop" className="mt-4">
              <Card className="bg-white">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-600">
                        De: {TEST_DATA.expediteur_email}
                      </div>
                      <div className="text-sm text-gray-600">
                        À:{" "}
                        {TEST_DATA.destinataire_nom
                          .toLowerCase()
                          .replace(" ", ".")}
                        @
                        {TEST_DATA.destinataire_entreprise
                          .toLowerCase()
                          .replace(" ", "")}
                        .com
                      </div>
                    </div>
                    <Badge variant="secondary">
                      Relance #{TEST_DATA.numero_relance}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h2 className="mb-4 text-xl font-semibold text-gray-900">
                    {renderedContent.subject}
                  </h2>
                  <Separator className="mb-4" />
                  <div
                    className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: htmlBody }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mobile" className="mt-4">
              <Card className="mx-auto max-w-sm bg-white">
                <div className="border-b bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-gray-600">
                        De: {TEST_DATA.expediteur_email}
                      </div>
                      <div className="truncate text-xs text-gray-600">
                        À:{" "}
                        {TEST_DATA.destinataire_nom
                          .toLowerCase()
                          .replace(" ", ".")}
                        @
                        {TEST_DATA.destinataire_entreprise
                          .toLowerCase()
                          .replace(" ", "")}
                        .com
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      #{TEST_DATA.numero_relance}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="mb-3 text-lg leading-tight font-semibold text-gray-900">
                    {renderedContent.subject}
                  </h3>
                  <Separator className="mb-3" />
                  <div
                    className="text-sm leading-relaxed text-gray-700"
                    dangerouslySetInnerHTML={{ __html: htmlBody }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Variables détectées */}
          <div className="mt-6 border-t pt-4">
            <h4 className="mb-3 text-sm font-medium">
              Variables utilisées dans ce template :
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.keys(TEST_DATA).map(variable => {
                const isUsed =
                  subject.includes(`{{${variable}}}`) ||
                  body.includes(`{{${variable}}}`);
                if (!isUsed) return null;

                return (
                  <Badge key={variable} variant="outline" className="text-xs">
                    {variable}: {TEST_DATA[variable as keyof typeof TEST_DATA]}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
