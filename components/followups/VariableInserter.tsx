"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Variable,
  Info,
  User,
  Building,
  Calendar,
  Hash,
  Mail,
  Clock,
} from "lucide-react";

interface VariableDefinition {
  name: string;
  description: string;
  example: string;
  category: "destinataire" | "email" | "relance" | "expediteur";
  icon: React.ComponentType<{ className?: string }>;
}

const AVAILABLE_VARIABLES: VariableDefinition[] = [
  {
    name: "destinataire_nom",
    description: "Nom du destinataire extrait de l'email",
    example: "John Doe",
    category: "destinataire",
    icon: User,
  },
  {
    name: "destinataire_entreprise",
    description: "Nom de l'entreprise du destinataire",
    example: "Acme Corp",
    category: "destinataire",
    icon: Building,
  },
  {
    name: "objet_original",
    description: "Sujet de l'email original",
    example: "Proposition commerciale Q4",
    category: "email",
    icon: Mail,
  },
  {
    name: "date_envoi_original",
    description: "Date d'envoi de l'email original",
    example: "15/09/2025",
    category: "email",
    icon: Calendar,
  },
  {
    name: "numero_relance",
    description: "Numéro de cette relance (1, 2 ou 3)",
    example: "2",
    category: "relance",
    icon: Hash,
  },
  {
    name: "jours_depuis_envoi",
    description: "Nombre de jours depuis l'envoi original",
    example: "5",
    category: "relance",
    icon: Clock,
  },
  {
    name: "expediteur_nom",
    description: "Nom de l'expéditeur original",
    example: "Marie Martin",
    category: "expediteur",
    icon: User,
  },
  {
    name: "expediteur_email",
    description: "Email de l'expéditeur original",
    example: "marie.martin@entreprise.com",
    category: "expediteur",
    icon: Mail,
  },
];

const categoryLabels = {
  destinataire: "Destinataire",
  email: "Email Original",
  relance: "Relance",
  expediteur: "Expéditeur",
};

const categoryColors = {
  destinataire: "bg-blue-100 text-blue-800",
  email: "bg-green-100 text-green-800",
  relance: "bg-purple-100 text-purple-800",
  expediteur: "bg-orange-100 text-orange-800",
};

interface VariableInserterProps {
  onInsert: (variable: string) => void;
  className?: string;
}

export function VariableInserter({
  onInsert,
  className,
}: VariableInserterProps) {
  const [open, setOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] =
    useState<VariableDefinition | null>(null);

  const handleInsert = (variable: VariableDefinition) => {
    onInsert(`{{${variable.name}}}`);
    setOpen(false);
  };

  const groupedVariables = AVAILABLE_VARIABLES.reduce(
    (acc, variable) => {
      if (!acc[variable.category]) {
        acc[variable.category] = [];
      }
      (acc[variable.category] as VariableDefinition[]).push(variable);
      return acc;
    },
    {} as Record<string, VariableDefinition[]>
  );

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Variable className="mr-2 h-4 w-4" />
            Insérer Variable
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[600px] p-0" align="start">
          <div className="flex">
            {/* Liste des variables */}
            <div className="w-1/2 border-r">
              <Command>
                <CommandInput placeholder="Rechercher une variable..." />
                <CommandList className="max-h-[400px]">
                  <CommandEmpty>Aucune variable trouvée.</CommandEmpty>
                  {Object.entries(groupedVariables).map(
                    ([category, variables]) => (
                      <CommandGroup
                        key={category}
                        heading={
                          categoryLabels[
                            category as keyof typeof categoryLabels
                          ]
                        }
                      >
                        {variables.map(variable => {
                          const Icon = variable.icon;
                          return (
                            <CommandItem
                              key={variable.name}
                              value={variable.name}
                              onSelect={() => setSelectedVariable(variable)}
                              className="cursor-pointer"
                            >
                              <Icon className="mr-2 h-4 w-4" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {`{{${variable.name}}}`}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${categoryColors[variable.category]}`}
                                  >
                                    {categoryLabels[variable.category]}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  {variable.description}
                                </p>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    )
                  )}
                </CommandList>
              </Command>
            </div>

            {/* Détails et aperçu */}
            <div className="w-1/2 p-4">
              {selectedVariable ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <selectedVariable.icon className="h-5 w-5" />
                        <CardTitle className="text-lg">
                          {`{{${selectedVariable.name}}}`}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="mb-1 text-sm font-medium">
                          Description
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          {selectedVariable.description}
                        </p>
                      </div>

                      <div>
                        <h4 className="mb-1 text-sm font-medium">Exemple</h4>
                        <Badge variant="outline" className="font-mono">
                          {selectedVariable.example}
                        </Badge>
                      </div>

                      <div>
                        <h4 className="mb-1 text-sm font-medium">Catégorie</h4>
                        <Badge
                          className={categoryColors[selectedVariable.category]}
                        >
                          {categoryLabels[selectedVariable.category]}
                        </Badge>
                      </div>

                      <Button
                        onClick={() => handleInsert(selectedVariable)}
                        className="w-full"
                        size="sm"
                      >
                        Insérer cette variable
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center">
                  <div className="space-y-2">
                    <Info className="text-muted-foreground mx-auto h-8 w-8" />
                    <p className="text-muted-foreground text-sm">
                      Sélectionnez une variable
                      <br />
                      pour voir les détails
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
