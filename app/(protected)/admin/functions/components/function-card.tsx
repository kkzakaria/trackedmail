"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PlayIcon,
  FileTextIcon,
  SettingsIcon,
  MoreVerticalIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "lucide-react";
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

interface FunctionCardProps {
  function: EdgeFunction;
  onExecute: () => void;
  onViewLogs: () => void;
}

export function FunctionCard({
  function: func,
  onExecute,
  onViewLogs,
}: FunctionCardProps) {
  const getStatusIcon = () => {
    switch (func.status) {
      case "active":
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case "inactive":
        return <XCircleIcon className="h-4 w-4 text-gray-400" />;
      case "error":
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      default:
        return <ClockIcon className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusVariant = () => {
    switch (func.status) {
      case "active":
        return "default" as const;
      case "inactive":
        return "secondary" as const;
      case "error":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const getStatusLabel = () => {
    switch (func.status) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "error":
        return "Erreur";
      default:
        return "Inconnu";
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{func.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={getStatusVariant()}
                className="flex items-center gap-1"
              >
                {getStatusIcon()}
                {getStatusLabel()}
              </Badge>
              <Badge variant="outline">{func.category}</Badge>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExecute}>
                <PlayIcon className="mr-2 h-4 w-4" />
                Exécuter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewLogs}>
                <FileTextIcon className="mr-2 h-4 w-4" />
                Voir les logs
              </DropdownMenuItem>
              <DropdownMenuItem>
                <SettingsIcon className="mr-2 h-4 w-4" />
                Configuration
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <CardDescription className="text-sm">
          {func.description}
        </CardDescription>

        {/* Function Details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Paramètres</span>
            <Badge variant="outline" className="text-xs">
              {func.parameters.length}
            </Badge>
          </div>

          {func.lastExecution && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dernière exécution</span>
              <span className="text-xs">
                {formatDistanceToNow(func.lastExecution, {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onExecute}
            size="sm"
            className="flex-1"
            disabled={func.status !== "active"}
          >
            <PlayIcon className="mr-2 h-4 w-4" />
            Exécuter
          </Button>
          <Button
            onClick={onViewLogs}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <FileTextIcon className="mr-2 h-4 w-4" />
            Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
