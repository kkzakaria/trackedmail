"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { followupService } from "@/lib/services/followup.service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Send,
  Ban,
  Calendar,
  Mail,
  User,
  Building,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  Edit,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import type { FollowupWithEmail, FollowupStatus } from "@/lib/types/followup.types";

interface TimelineEvent {
  id: string;
  type: "email_sent" | "followup_scheduled" | "followup_sent" | "followup_failed" | "followup_cancelled" | "response_received";
  title: string;
  description: string;
  timestamp: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "success" | "warning" | "destructive";
}

export default function FollowupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const followupId = params.id as string;

  // State management
  const [followup, setFollowup] = useState<FollowupWithEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // Dialog states
  const [rescheduleDialog, setRescheduleDialog] = useState<{
    open: boolean;
    newDate: string;
  }>({
    open: false,
    newDate: "",
  });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    subject: string;
    body: string;
  }>({
    open: false,
    subject: "",
    body: "",
  });

  // Load followup data
  const loadFollowup = async () => {
    try {
      setLoading(true);
      const data = await followupService.getFollowupById(followupId);

      if (!data) {
        toast.error("Relance non trouvée");
        router.push("/dashboard/followups");
        return;
      }

      setFollowup(data);

      // Initialize dialogs with current data
      setRescheduleDialog(prev => ({
        ...prev,
        newDate: data.scheduled_for || "",
      }));

      setEditDialog(prev => ({
        ...prev,
        subject: data.subject || "",
        body: data.body || "",
      }));

      // Load timeline
      await loadTimeline(data);
    } catch (error) {
      console.error("Erreur lors du chargement de la relance:", error);
      toast.error("Impossible de charger la relance");
      router.push("/dashboard/followups");
    } finally {
      setLoading(false);
    }
  };

  // Load timeline events
  const loadTimeline = async (followupData: FollowupWithEmail) => {
    try {
      const events: TimelineEvent[] = [];

      // Original email sent
      if (followupData.tracked_email?.sent_at) {
        events.push({
          id: "email_sent",
          type: "email_sent",
          title: "Email original envoyé",
          description: `Email envoyé à ${followupData.tracked_email.recipient_emails?.[0]}`,
          timestamp: followupData.tracked_email.sent_at,
          icon: Mail,
          variant: "default",
        });
      }

      // Followup scheduled
      if (followupData.scheduled_for) {
        events.push({
          id: "followup_scheduled",
          type: "followup_scheduled",
          title: `Relance ${followupData.followup_number} programmée`,
          description: `Programmée pour le ${format(parseISO(followupData.scheduled_for), "dd/MM/yyyy à HH:mm", { locale: fr })}`,
          timestamp: followupData.created_at || followupData.scheduled_for,
          icon: Clock,
          variant: "default",
        });
      }

      // Followup sent
      if (followupData.status === "sent" && followupData.sent_at) {
        events.push({
          id: "followup_sent",
          type: "followup_sent",
          title: `Relance ${followupData.followup_number} envoyée`,
          description: "Relance envoyée avec succès",
          timestamp: followupData.sent_at,
          icon: Send,
          variant: "success",
        });
      }

      // Followup failed
      if (followupData.status === "failed" && followupData.failed_at) {
        events.push({
          id: "followup_failed",
          type: "followup_failed",
          title: `Échec de la relance ${followupData.followup_number}`,
          description: followupData.failure_reason || "Erreur lors de l'envoi",
          timestamp: followupData.failed_at,
          icon: XCircle,
          variant: "destructive",
        });
      }

      // Followup cancelled
      if (followupData.status === "cancelled") {
        events.push({
          id: "followup_cancelled",
          type: "followup_cancelled",
          title: `Relance ${followupData.followup_number} annulée`,
          description: followupData.failure_reason || "Relance annulée",
          timestamp: followupData.updated_at || followupData.created_at || new Date().toISOString(),
          icon: Ban,
          variant: "warning",
        });
      }

      // Response received
      if (followupData.tracked_email?.responded_at) {
        events.push({
          id: "response_received",
          type: "response_received",
          title: "Réponse reçue",
          description: "Le destinataire a répondu à l'email",
          timestamp: followupData.tracked_email.responded_at,
          icon: CheckCircle,
          variant: "success",
        });
      }

      // Sort events by timestamp
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setTimeline(events);
    } catch (error) {
      console.error("Erreur lors du chargement de la timeline:", error);
    }
  };

  useEffect(() => {
    if (followupId) {
      loadFollowup();
    }
  }, [followupId]);

  // Status configuration
  const getStatusConfig = (status: FollowupStatus) => {
    const config = {
      scheduled: { variant: "default" as const, label: "Programmé", icon: Clock },
      sent: { variant: "success" as const, label: "Envoyé", icon: CheckCircle },
      failed: { variant: "destructive" as const, label: "Échec", icon: XCircle },
      cancelled: { variant: "secondary" as const, label: "Annulé", icon: Ban },
    };

    return config[status] || config.scheduled;
  };

  // Handle actions
  const handleReschedule = async () => {
    if (!followup || !rescheduleDialog.newDate) return;

    try {
      await followupService.rescheduleFollowup(
        followup.id,
        new Date(rescheduleDialog.newDate).toISOString()
      );

      setRescheduleDialog({ open: false, newDate: "" });
      await loadFollowup();
      toast.success("Relance reprogrammée avec succès");
    } catch (error) {
      console.error("Erreur lors de la reprogrammation:", error);
      toast.error("Impossible de reprogrammer la relance");
    }
  };

  const handleCancel = async () => {
    if (!followup?.tracked_email?.id) return;

    try {
      await followupService.cancelFollowups(
        followup.tracked_email.id,
        "Annulé manuellement depuis le dashboard"
      );

      await loadFollowup();
      toast.success("Relance annulée avec succès");
    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
      toast.error("Impossible d'annuler la relance");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié dans le presse-papiers`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!followup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Relance non trouvée</h1>
          <p className="text-gray-600 mb-4">Cette relance n'existe pas ou a été supprimée.</p>
          <Link href="/dashboard/followups">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux relances
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(followup.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/dashboard/followups">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Relance {followup.followup_number}
                </h1>
                <p className="text-sm text-gray-500">
                  {followup.tracked_email?.subject || "Sans sujet"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                <statusConfig.icon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Followup Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Détails de la relance</CardTitle>
                    <div className="flex gap-2">
                      {followup.status === "scheduled" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRescheduleDialog({ ...rescheduleDialog, open: true })}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            Reprogrammer
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Ban className="mr-2 h-4 w-4" />
                                Annuler
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Annuler la relance</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir annuler cette relance ? Cette action est irréversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCancel}>
                                  Confirmer l'annulation
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Niveau de relance</Label>
                      <p className="mt-1">Relance {followup.followup_number}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Template utilisé</Label>
                      <p className="mt-1">{followup.template?.name || "Template supprimé"}</p>
                    </div>
                    {followup.scheduled_for && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Programmé pour</Label>
                        <p className="mt-1">
                          {format(parseISO(followup.scheduled_for), "dd/MM/yyyy à HH:mm", { locale: fr })}
                        </p>
                      </div>
                    )}
                    {followup.sent_at && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Envoyé le</Label>
                        <p className="mt-1">
                          {format(parseISO(followup.sent_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                        </p>
                      </div>
                    )}
                  </div>

                  {followup.failure_reason && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Raison de l'échec</Label>
                      <p className="mt-1 text-red-600">{followup.failure_reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email Content */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Contenu de la relance</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(followup.body || "", "Contenu")}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copier
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Sujet</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="flex-1">{followup.subject}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(followup.subject || "", "Sujet")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm font-medium text-gray-600">Corps du message</Label>
                    <div className="mt-1 p-4 bg-gray-50 rounded-lg border">
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: followup.body?.replace(/\n/g, "<br>") || "",
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Original Email Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Original
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Sujet</Label>
                    <p className="mt-1 text-sm">{followup.tracked_email?.subject}</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-600">Destinataire</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{followup.tracked_email?.recipient_emails?.[0]}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-600">Expéditeur</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{followup.tracked_email?.sender_email}</span>
                    </div>
                  </div>

                  {followup.tracked_email?.sent_at && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Envoyé le</Label>
                      <p className="mt-1 text-sm">
                        {format(parseISO(followup.tracked_email.sent_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium text-gray-600">Statut</Label>
                    <div className="mt-1">
                      <Badge variant={followup.tracked_email?.status === "responded" ? "success" : "default"}>
                        {followup.tracked_email?.status === "responded" ? "Répondu" : "En attente"}
                      </Badge>
                    </div>
                  </div>

                  <Link href={`/dashboard/emails/${followup.tracked_email?.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Voir l'email
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Chronologie</CardTitle>
                  <CardDescription>Historique des événements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timeline.map((event, index) => (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`
                            flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs
                            ${event.variant === "success" ? "border-green-200 bg-green-50 text-green-600" :
                              event.variant === "destructive" ? "border-red-200 bg-red-50 text-red-600" :
                              event.variant === "warning" ? "border-yellow-200 bg-yellow-50 text-yellow-600" :
                              "border-gray-200 bg-gray-50 text-gray-600"}
                          `}>
                            <event.icon className="h-4 w-4" />
                          </div>
                          {index < timeline.length - 1 && (
                            <div className="w-px h-6 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="font-medium text-sm">{event.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(parseISO(event.timestamp), "dd/MM/yyyy à HH:mm", { locale: fr })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Reschedule Dialog */}
      <Dialog
        open={rescheduleDialog.open}
        onOpenChange={(open) => setRescheduleDialog({ ...rescheduleDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprogrammer la relance</DialogTitle>
            <DialogDescription>
              Choisissez une nouvelle date et heure pour cette relance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="new-date">Nouvelle date et heure</Label>
              <Input
                id="new-date"
                type="datetime-local"
                value={rescheduleDialog.newDate.slice(0, 16)}
                onChange={(e) =>
                  setRescheduleDialog({
                    ...rescheduleDialog,
                    newDate: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRescheduleDialog({ open: false, newDate: "" })}
            >
              Annuler
            </Button>
            <Button onClick={handleReschedule}>Reprogrammer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}