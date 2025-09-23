"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
  Shield,
  Target
} from "lucide-react";

import type { FollowupSettings } from "@/lib/types/followup.types";

interface FollowupGlobalSettingsProps {
  settings: FollowupSettings;
  onChange: (settings: FollowupSettings) => void;
}

export function FollowupGlobalSettings({ settings, onChange }: FollowupGlobalSettingsProps) {
  const [errors, setErrors] = useState<string[]>([]);

  // Validate settings
  useEffect(() => {
    validateSettings();
  }, [settings]);

  const validateSettings = () => {
    const newErrors: string[] = [];

    if (settings.max_followups < 1 || settings.max_followups > 10) {
      newErrors.push("Le nombre maximum de relances doit être entre 1 et 10");
    }

    if (settings.default_interval_hours < 1 || settings.default_interval_hours > 720) {
      newErrors.push("L'intervalle par défaut doit être entre 1 heure et 30 jours");
    }

    if (settings.stop_after_days < 1 || settings.stop_after_days > 365) {
      newErrors.push("La durée d'expiration doit être entre 1 et 365 jours");
    }

    if (settings.rate_limit_per_hour < 1 || settings.rate_limit_per_hour > 1000) {
      newErrors.push("La limite de taux doit être entre 1 et 1000 emails par heure");
    }

    setErrors(newErrors);
  };

  const updateSettings = (updates: Partial<FollowupSettings>) => {
    onChange({ ...settings, ...updates });
  };

  const getIntervalDisplay = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}j`;
    return `${days}j ${remainingHours}h`;
  };

  const getEfficiencyScore = () => {
    let score = 0;

    // Max followups (optimal: 3)
    if (settings.max_followups === 3) score += 25;
    else if (settings.max_followups === 2 || settings.max_followups === 4) score += 20;
    else if (settings.max_followups === 1 || settings.max_followups === 5) score += 15;
    else score += 10;

    // Interval (optimal: 72-120 hours)
    if (settings.default_interval_hours >= 72 && settings.default_interval_hours <= 120) score += 25;
    else if (settings.default_interval_hours >= 48 && settings.default_interval_hours <= 168) score += 20;
    else score += 10;

    // Stop after days (optimal: 14-30 days)
    if (settings.stop_after_days >= 14 && settings.stop_after_days <= 30) score += 25;
    else if (settings.stop_after_days >= 7 && settings.stop_after_days <= 60) score += 20;
    else score += 10;

    // System enabled
    if (settings.system_enabled) score += 25;

    return score;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-blue-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellente";
    if (score >= 70) return "Bonne";
    if (score >= 50) return "Correcte";
    return "À améliorer";
  };

  const efficiencyScore = getEfficiencyScore();

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card className={settings.system_enabled ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>État du Système</span>
            </div>
            <Badge variant={settings.system_enabled ? "default" : "destructive"}>
              {settings.system_enabled ? "Actif" : "Inactif"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                {settings.system_enabled ? "Système de relances activé" : "Système de relances désactivé"}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {settings.system_enabled
                  ? "Les relances automatiques sont opérationnelles"
                  : "Aucune relance ne sera envoyée automatiquement"
                }
              </div>
            </div>
            <Switch
              checked={settings.system_enabled}
              onCheckedChange={(checked) => updateSettings({ system_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Core Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Max Followups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-lg">
              <Target className="w-4 h-4" />
              <span>Nombre Maximum de Relances</span>
            </CardTitle>
            <CardDescription>
              Nombre maximum de relances envoyées par email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Label htmlFor="max-followups" className="min-w-[60px]">Maximum</Label>
                <Input
                  id="max-followups"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.max_followups}
                  onChange={(e) => updateSettings({ max_followups: parseInt(e.target.value) || 3 })}
                  className="w-20 text-center"
                />
                <span className="text-sm text-gray-500">relances</span>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <Button
                    key={num}
                    variant={settings.max_followups === num ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateSettings({ max_followups: num })}
                  >
                    {num}
                  </Button>
                ))}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Recommandé : 3 relances (compromis optimal entre efficacité et respect)
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {/* Default Interval */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-lg">
              <Clock className="w-4 h-4" />
              <span>Intervalle Par Défaut</span>
            </CardTitle>
            <CardDescription>
              Délai par défaut entre chaque relance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Label htmlFor="interval-hours" className="min-w-[60px]">Heures</Label>
                <Input
                  id="interval-hours"
                  type="number"
                  min="1"
                  max="720"
                  value={settings.default_interval_hours}
                  onChange={(e) => updateSettings({ default_interval_hours: parseInt(e.target.value) || 96 })}
                  className="w-20 text-center"
                />
                <span className="text-sm text-gray-500">
                  ({getIntervalDisplay(settings.default_interval_hours)})
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({ default_interval_hours: 24 })}
                >
                  1 jour
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({ default_interval_hours: 72 })}
                >
                  3 jours
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({ default_interval_hours: 168 })}
                >
                  1 semaine
                </Button>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Recommandé : 72-120h (3-5 jours) pour un bon équilibre
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {/* Stop After Days */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Durée d'Expiration</CardTitle>
            <CardDescription>
              Arrêt automatique des relances après ce délai
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Label htmlFor="stop-days" className="min-w-[60px]">Jours</Label>
                <Input
                  id="stop-days"
                  type="number"
                  min="1"
                  max="365"
                  value={settings.stop_after_days}
                  onChange={(e) => updateSettings({ stop_after_days: parseInt(e.target.value) || 30 })}
                  className="w-20 text-center"
                />
                <span className="text-sm text-gray-500">jours</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({ stop_after_days: 14 })}
                >
                  2 semaines
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({ stop_after_days: 30 })}
                >
                  1 mois
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({ stop_after_days: 60 })}
                >
                  2 mois
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-lg">
              <Zap className="w-4 h-4" />
              <span>Limitation de Taux</span>
            </CardTitle>
            <CardDescription>
              Nombre maximum d'emails envoyés par heure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Label htmlFor="rate-limit" className="min-w-[60px]">Limite</Label>
                <Input
                  id="rate-limit"
                  type="number"
                  min="1"
                  max="1000"
                  value={settings.rate_limit_per_hour}
                  onChange={(e) => updateSettings({ rate_limit_per_hour: parseInt(e.target.value) || 100 })}
                  className="w-20 text-center"
                />
                <span className="text-sm text-gray-500">emails/heure</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({ rate_limit_per_hour: 50 })}
                >
                  50/h
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({ rate_limit_per_hour: 100 })}
                >
                  100/h
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({ rate_limit_per_hour: 200 })}
                >
                  200/h
                </Button>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Ajustez selon les limites de votre fournisseur email
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Score */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-800">
            <Target className="w-5 h-5" />
            <span>Score d'Efficacité</span>
          </CardTitle>
          <CardDescription>
            Évaluation de votre configuration selon les meilleures pratiques
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-3xl font-bold ${getScoreColor(efficiencyScore)}`}>
                  {efficiencyScore}%
                </div>
                <div className={`text-sm ${getScoreColor(efficiencyScore)}`}>
                  Configuration {getScoreLabel(efficiencyScore)}
                </div>
              </div>
              <div className="w-32">
                <Progress value={efficiencyScore} className="h-3" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold">{settings.max_followups}</div>
                <div className="text-sm text-gray-600">Max relances</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{getIntervalDisplay(settings.default_interval_hours)}</div>
                <div className="text-sm text-gray-600">Intervalle</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{settings.stop_after_days}j</div>
                <div className="text-sm text-gray-600">Expiration</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{settings.rate_limit_per_hour}/h</div>
                <div className="text-sm text-gray-600">Taux limite</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {errors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {errors.length === 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Configuration valide. Les paramètres seront appliqués à toutes les nouvelles relances.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}