"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Clock,
  Calendar,
  Settings,
  TestTube,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Info
} from "lucide-react";

import { WorkingHoursConfig } from "@/components/followups/WorkingHoursConfig";
import { HolidaysManager } from "@/components/followups/HolidaysManager";
import { FollowupGlobalSettings } from "@/components/followups/FollowupGlobalSettings";
import { TestScheduler } from "@/components/followups/TestScheduler";

import { SchedulingService } from "@/lib/services/scheduling.service";
import { FollowupService } from "@/lib/services/followup.service";
import type {
  WorkingHoursConfig as WorkingHoursConfigType,
  FollowupSettings
} from "@/lib/types/followup.types";

export default function FollowupSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("working-hours");

  // Configuration states
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfigType | null>(null);
  const [globalSettings, setGlobalSettings] = useState<FollowupSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Services
  const schedulingService = new SchedulingService();
  const followupService = new FollowupService();

  // Load initial configuration
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);

      const [workingHoursConfig, followupSettings] = await Promise.all([
        schedulingService.getWorkingHoursConfig(),
        followupService.getFollowupSettings()
      ]);

      setWorkingHours(workingHoursConfig);
      setGlobalSettings(followupSettings);
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur lors du chargement de la configuration:", error);
      toast.error("Impossible de charger la configuration");
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    if (!workingHours || !globalSettings) return;

    try {
      setSaving(true);

      await Promise.all([
        schedulingService.updateWorkingHoursConfig(workingHours),
        followupService.updateFollowupSettings(globalSettings)
      ]);

      setHasChanges(false);
      toast.success("Configuration sauvegardée avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const resetConfiguration = async () => {
    await loadConfiguration();
    toast.info("Configuration rechargée");
  };

  const handleWorkingHoursChange = (newConfig: WorkingHoursConfigType) => {
    setWorkingHours(newConfig);
    setHasChanges(true);
  };

  const handleGlobalSettingsChange = (newSettings: FollowupSettings) => {
    setGlobalSettings(newSettings);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Configuration des Relances
            </h1>
            <p className="text-gray-600 mt-1">
              Gérez les heures ouvrables, jours fériés et paramètres globaux du système de relances
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {hasChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-200">
                <AlertCircle className="w-3 h-3 mr-1" />
                Modifications non sauvegardées
              </Badge>
            )}

            <Button
              variant="outline"
              onClick={resetConfiguration}
              disabled={saving || !hasChanges}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Annuler
            </Button>

            <Button
              onClick={saveConfiguration}
              disabled={saving || !hasChanges}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </div>

        {/* Status Alert */}
        {!hasChanges && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              La configuration est à jour. Toute modification sera automatiquement détectée.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Configuration Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="working-hours" className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Heures Ouvrables</span>
            </TabsTrigger>
            <TabsTrigger value="holidays" className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Jours Fériés</span>
            </TabsTrigger>
            <TabsTrigger value="global-settings" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Paramètres Globaux</span>
            </TabsTrigger>
            <TabsTrigger value="test-scheduler" className="flex items-center space-x-2">
              <TestTube className="w-4 h-4" />
              <span>Test Planification</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="working-hours" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Configuration des Heures Ouvrables</span>
                </CardTitle>
                <CardDescription>
                  Définissez les créneaux horaires pendant lesquels les relances peuvent être envoyées
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workingHours && (
                  <WorkingHoursConfig
                    config={workingHours}
                    onChange={handleWorkingHoursChange}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="holidays" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Gestion des Jours Fériés</span>
                </CardTitle>
                <CardDescription>
                  Configurez les jours fériés pendant lesquels aucune relance ne sera envoyée
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workingHours && (
                  <HolidaysManager
                    holidays={workingHours.holidays}
                    timezone={workingHours.timezone}
                    onChange={(holidays) =>
                      handleWorkingHoursChange({ ...workingHours, holidays })
                    }
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="global-settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Paramètres Globaux des Relances</span>
                </CardTitle>
                <CardDescription>
                  Configurez les règles générales du système de relances automatiques
                </CardDescription>
              </CardHeader>
              <CardContent>
                {globalSettings && (
                  <FollowupGlobalSettings
                    settings={globalSettings}
                    onChange={handleGlobalSettingsChange}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test-scheduler" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TestTube className="w-5 h-5" />
                  <span>Test de Planification</span>
                </CardTitle>
                <CardDescription>
                  Simulez la planification des relances avec la configuration actuelle
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workingHours && globalSettings && (
                  <TestScheduler
                    workingHours={workingHours}
                    globalSettings={globalSettings}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}