import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database.types";
import type { QueryData } from "@supabase/supabase-js";
import {
  FollowupWithEmail,
  FollowupStatus,
  FollowupScheduleParams,
  FollowupStatistics,
  FollowupFilters,
  PaginationParams,
  SendContext,
  SchedulingResult,
  FollowupStatsItem,
} from "@/lib/types/followup.types";
import { FollowupTemplateService } from "./followup-template.service";

export class FollowupService {
  private supabase: ReturnType<typeof createClient>;
  private templateService: FollowupTemplateService;

  constructor(supabaseClient?: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient || createClient();
    this.templateService = new FollowupTemplateService();
  }

  /**
   * Récupère les relances avec pagination et filtres
   */
  async getFollowups(params?: {
    pagination?: PaginationParams;
    filters?: FollowupFilters;
    include_email_data?: boolean;
  }) {
    // Définir la requête selon le pattern officiel Supabase
    const selectClause = params?.include_email_data
      ? `
        *,
        tracked_email:tracked_emails!inner(
          id,
          subject,
          sender_email,
          recipient_emails,
          sent_at,
          status
        ),
        template:followup_templates(
          id,
          name,
          followup_number
        )
      `
      : "*";

    const followupsQuery = this.supabase.from("followups").select(
      selectClause,
      { count: "exact" }
    );

    // Type inféré automatiquement par QueryData
    type FollowupsQueryResult = QueryData<typeof followupsQuery>;

    let query = followupsQuery;

    // Appliquer les filtres
    if (params?.filters) {
      query = this.applyFilters(query, params.filters);
    }

    // Tri
    const sortBy = params?.pagination?.sort_by || "scheduled_for";
    const sortOrder = params?.pagination?.sort_order || "asc";
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Pagination
    const page = params?.pagination?.page || 1;
    const perPage = params?.pagination?.per_page || 20;
    const offset = (page - 1) * perPage;

    query = query.range(offset, offset + perPage - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(
        `Erreur lors de la récupération des relances: ${error.message}`
      );
    }

    return {
      data: (data || []) as FollowupsQueryResult,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
        has_next: page < Math.ceil((count || 0) / perPage),
        has_prev: page > 1,
      },
    };
  }

  /**
   * Récupère une relance par son ID
   */
  async getFollowupById(id: string): Promise<FollowupWithEmail | null> {
    const { data, error } = await this.supabase
      .from("followups")
      .select(
        `
        *,
        tracked_email:tracked_emails!inner(
          id,
          subject,
          sender_email,
          recipient_emails,
          sent_at,
          status,
          mailbox:mailboxes!inner(
            id,
            email_address,
            display_name,
            microsoft_user_id
          )
        ),
        template:followup_templates(
          id,
          name,
          followup_number,
          subject,
          body
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(
        `Erreur lors de la récupération de la relance: ${error.message}`
      );
    }

    return data as FollowupWithEmail;
  }

  /**
   * Récupère les relances pour un email spécifique
   */
  async getFollowupsForEmail(
    trackedEmailId: string
  ): Promise<Database["public"]["Tables"]["followups"]["Row"][]> {
    const { data, error } = await this.supabase
      .from("followups")
      .select("*")
      .eq("tracked_email_id", trackedEmailId)
      .order("followup_number", { ascending: true });

    if (error) {
      throw new Error(
        `Erreur lors de la récupération des relances: ${error.message}`
      );
    }

    return data || [];
  }

  /**
   * Récupère les relances programmées prêtes à être envoyées
   */
  async getScheduledFollowups(limit?: number): Promise<FollowupWithEmail[]> {
    const now = new Date().toISOString();

    let query = this.supabase
      .from("followups")
      .select(
        `
        *,
        tracked_email:tracked_emails!inner(
          id,
          subject,
          sender_email,
          recipient_emails,
          sent_at,
          status,
          mailbox:mailboxes!inner(
            id,
            email_address,
            display_name,
            microsoft_user_id
          )
        ),
        template:followup_templates!inner(
          id,
          name,
          followup_number,
          subject,
          body,
          available_variables
        )
      `
      )
      .eq("status", "scheduled")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Erreur lors de la récupération des relances programmées: ${error.message}`
      );
    }

    return data || [];
  }

  /**
   * Crée une nouvelle relance programmée
   */
  async createFollowup(
    params: FollowupScheduleParams
  ): Promise<Database["public"]["Tables"]["followups"]["Row"]> {
    // Récupérer le template
    const template = await this.templateService.getTemplateById(
      params.template_id
    );
    if (!template) {
      throw new Error("Template non trouvé");
    }

    // Vérifier que l'email existe et est en attente
    const { data: trackedEmail, error: emailError } = await this.supabase
      .from("tracked_emails")
      .select("id, status, sent_at, subject, recipient_emails, sender_email")
      .eq("id", params.tracked_email_id)
      .single();

    if (emailError || !trackedEmail) {
      throw new Error("Email suivi non trouvé");
    }

    if (trackedEmail.status !== "pending") {
      throw new Error(
        "Impossible de programmer une relance pour un email qui n'est plus en attente"
      );
    }

    // Vérifier qu'il n'y a pas déjà une relance programmée pour ce niveau
    const { data: existingFollowup } = await this.supabase
      .from("followups")
      .select("id")
      .eq("tracked_email_id", params.tracked_email_id)
      .eq("followup_number", params.followup_number)
      .eq("status", "scheduled")
      .limit(1);

    if (existingFollowup && existingFollowup.length > 0) {
      throw new Error(
        `Une relance ${params.followup_number} est déjà programmée pour cet email`
      );
    }

    // Calculer la date de programmation
    const schedulingResult = await this.calculateScheduledTime(
      trackedEmail.sent_at,
      params.delay_hours || template.delay_hours || 96,
      params.force_schedule
    );

    // Rendre le template avec les variables
    const renderedTemplate = await this.templateService.renderTemplate({
      template,
      variables: {
        numero_relance: params.followup_number,
        objet_original: trackedEmail.subject,
        destinataire_nom: this.extractNameFromEmail(
          trackedEmail.recipient_emails[0] || ""
        ),
        date_envoi_original: new Date(trackedEmail.sent_at).toLocaleDateString(
          "fr-FR"
        ),
        jours_depuis_envoi: Math.floor(
          (Date.now() - new Date(trackedEmail.sent_at).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      },
      tracked_email_id: params.tracked_email_id,
    });

    // Créer la relance
    const followupData: Database["public"]["Tables"]["followups"]["Insert"] = {
      tracked_email_id: params.tracked_email_id,
      template_id: params.template_id,
      followup_number: params.followup_number,
      subject: renderedTemplate.subject,
      body: renderedTemplate.body,
      scheduled_for: schedulingResult.scheduled_for,
      status: "scheduled",
    };

    const { data, error } = await this.supabase
      .from("followups")
      .insert(followupData)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Erreur lors de la création de la relance: ${error.message}`
      );
    }

    return data;
  }

  /**
   * Programme automatiquement les relances pour un email
   */
  async scheduleFollowups(
    trackedEmailId: string
  ): Promise<Database["public"]["Tables"]["followups"]["Row"][]> {
    // Récupérer l'email suivi
    const { data: trackedEmail, error } = await this.supabase
      .from("tracked_emails")
      .select("id, status, sent_at")
      .eq("id", trackedEmailId)
      .single();

    if (error || !trackedEmail) {
      throw new Error("Email suivi non trouvé");
    }

    if (trackedEmail.status !== "pending") {
      return []; // Pas de relances pour les emails qui ne sont plus en attente
    }

    // Récupérer les templates actifs
    const activeTemplates = await Promise.all([
      this.templateService.getActiveTemplateByNumber(1),
      this.templateService.getActiveTemplateByNumber(2),
      this.templateService.getActiveTemplateByNumber(3),
    ]);

    const validTemplates = activeTemplates.filter(t => t !== null);
    if (validTemplates.length === 0) {
      throw new Error("Aucun template actif trouvé");
    }

    // Créer les relances
    const createdFollowups: Database["public"]["Tables"]["followups"]["Row"][] =
      [];

    for (const template of validTemplates) {
      if (!template) continue;

      try {
        const followup = await this.createFollowup({
          tracked_email_id: trackedEmailId,
          template_id: template.id,
          followup_number: template.followup_number,
          delay_hours: template.delay_hours || 96,
        });
        createdFollowups.push(followup);
      } catch (error) {
        console.error(
          `Erreur lors de la création de la relance ${template.followup_number}:`,
          error
        );
        // Continuer avec les autres relances
      }
    }

    return createdFollowups;
  }

  /**
   * Envoie une relance
   */
  async sendFollowup(
    followupId: string,
    _sendContext: SendContext
  ): Promise<void> {
    // Récupérer la relance avec toutes les données
    const followup = await this.getFollowupById(followupId);
    if (!followup) {
      throw new Error("Relance non trouvée");
    }

    if (followup.status !== "scheduled") {
      throw new Error("Seules les relances programmées peuvent être envoyées");
    }

    try {
      // TODO: Implémenter sendMessage dans microsoftGraphService
      // Préparer les données du message pour l'envoi via Microsoft Graph
      // const messageData = {
      //   subject: followup.subject,
      //   body: {
      //     contentType: 'HTML',
      //     content: this.convertToHtml(followup.body)
      //   },
      //   toRecipients: followup.tracked_email?.recipient_emails?.map(email => ({
      //     emailAddress: { address: email }
      //   })) || [],
      //   replyTo: [{
      //     emailAddress: { address: followup.tracked_email?.sender_email || sendContext.access_token }
      //   }]
      // };
      // const sentMessage = await microsoftGraphService.sendMessage(
      //   sendContext.microsoft_user_id,
      //   messageData,
      //   sendContext.access_token
      // );
      const sentMessage = { id: "temp-id-" + Date.now() };

      // Mettre à jour le statut de la relance
      await this.updateFollowupStatus(followupId, "sent", {
        microsoft_message_id: sentMessage.id,
        sent_at: new Date().toISOString(),
      });
    } catch (error) {
      // Marquer comme échec
      await this.updateFollowupStatus(followupId, "failed", {
        failed_at: new Date().toISOString(),
        failure_reason:
          error instanceof Error ? error.message : "Erreur inconnue",
      });

      throw new Error(
        `Échec de l'envoi de la relance: ${error instanceof Error ? error.message : "Erreur inconnue"}`
      );
    }
  }

  /**
   * Annule les relances programmées pour un email
   */
  async cancelFollowups(
    trackedEmailId: string,
    reason?: string
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from("followups")
      .update({
        status: "cancelled",
        failure_reason: reason || "Annulé automatiquement",
      })
      .eq("tracked_email_id", trackedEmailId)
      .eq("status", "scheduled")
      .select("id");

    if (error) {
      throw new Error(
        `Erreur lors de l'annulation des relances: ${error.message}`
      );
    }

    return data?.length || 0;
  }

  /**
   * Met à jour le statut d'une relance
   */
  async updateFollowupStatus(
    followupId: string,
    status: FollowupStatus,
    updates?: Partial<Database["public"]["Tables"]["followups"]["Update"]>
  ): Promise<Database["public"]["Tables"]["followups"]["Row"]> {
    const updateData: Database["public"]["Tables"]["followups"]["Update"] = {
      status,
      ...updates,
    };

    const { data, error } = await this.supabase
      .from("followups")
      .update(updateData)
      .eq("id", followupId)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Erreur lors de la mise à jour du statut: ${error.message}`
      );
    }

    return data;
  }

  /**
   * Reprogramme une relance
   */
  async rescheduleFollowup(
    followupId: string,
    newScheduledTime: string
  ): Promise<Database["public"]["Tables"]["followups"]["Row"]> {
    return this.updateFollowupStatus(followupId, "scheduled", {
      scheduled_for: newScheduledTime,
      failed_at: null,
      failure_reason: null,
    });
  }

  /**
   * Récupère les statistiques des relances
   */
  async getStatistics(filters?: {
    date_from?: string;
    date_to?: string;
    mailbox_id?: string;
  }): Promise<FollowupStatistics> {
    let query = this.supabase.from("followups").select(`
        status,
        followup_number,
        sent_at,
        template:followup_templates(id, name),
        tracked_email:tracked_emails!inner(
          mailbox_id,
          sent_at,
          responded_at
        )
      `);

    // Appliquer les filtres de date
    if (filters?.date_from) {
      query = query.gte("created_at", filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte("created_at", filters.date_to);
    }
    if (filters?.mailbox_id) {
      query = query.eq("tracked_email.mailbox_id", filters.mailbox_id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Erreur lors du calcul des statistiques: ${error.message}`
      );
    }

    return this.calculateStatistics(data || []);
  }

  // Méthodes privées utilitaires

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyFilters(query: any, filters: FollowupFilters): any {
    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    }

    if (filters.template_id) {
      query = query.eq("template_id", filters.template_id);
    }

    if (filters.followup_number) {
      query = query.eq("followup_number", filters.followup_number);
    }

    if (filters.date_from) {
      query = query.gte("scheduled_for", filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte("scheduled_for", filters.date_to);
    }

    if (filters.mailbox_id) {
      query = query.eq("tracked_email.mailbox_id", filters.mailbox_id);
    }

    if (filters.search_query) {
      query = query.or(
        `subject.ilike.%${filters.search_query}%,body.ilike.%${filters.search_query}%`
      );
    }

    return query;
  }

  private async calculateScheduledTime(
    originalSentAt: string,
    delayHours: number,
    forceSchedule = false
  ): Promise<SchedulingResult> {
    const originalDate = new Date(originalSentAt);
    const targetDate = new Date(
      originalDate.getTime() + delayHours * 60 * 60 * 1000
    );

    if (forceSchedule) {
      return {
        scheduled_for: targetDate.toISOString(),
        original_target: targetDate.toISOString(),
        adjusted_for_working_hours: false,
        delay_applied_hours: delayHours,
      };
    }

    // Ici, nous devrions intégrer avec le SchedulingService pour respecter les heures ouvrables
    // Pour l'instant, nous programmons directement à la date cible
    return {
      scheduled_for: targetDate.toISOString(),
      original_target: targetDate.toISOString(),
      adjusted_for_working_hours: false,
      delay_applied_hours: delayHours,
    };
  }

  private extractNameFromEmail(email: string): string {
    const localPart = email.split("@")[0];
    if (!localPart) {
      return "Destinataire";
    }
    return localPart
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private calculateStatistics(data: FollowupStatsItem[]): FollowupStatistics {
    const total_sent = data.filter(f => f.status === "sent").length;
    const total_scheduled = data.filter(f => f.status === "scheduled").length;
    const total_failed = data.filter(f => f.status === "failed").length;
    const total_cancelled = data.filter(f => f.status === "cancelled").length;

    // Calcul du taux de succès (relances qui ont généré une réponse)
    const successfulFollowups = data.filter(
      f =>
        f.status === "sent" &&
        f.tracked_email?.responded_at &&
        f.sent_at &&
        new Date(f.tracked_email.responded_at) > new Date(f.sent_at)
    );

    const success_rate =
      total_sent > 0 ? (successfulFollowups.length / total_sent) * 100 : 0;

    // Calcul du temps de réponse moyen
    const responseTimes = successfulFollowups
      .map(f => {
        if (!f.sent_at || !f.tracked_email?.responded_at) return 0;
        const sentTime = new Date(f.sent_at).getTime();
        const responseTime = new Date(f.tracked_email.responded_at).getTime();
        return (responseTime - sentTime) / (1000 * 60 * 60); // en heures
      })
      .filter(time => time > 0);

    const average_response_time_hours =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    // Statistiques par template
    const templateStats = new Map();
    data.forEach(f => {
      if (f.template && f.status === "sent") {
        const key = f.template.id;
        if (!templateStats.has(key)) {
          templateStats.set(key, {
            template_id: f.template.id,
            template_name: f.template.name,
            sent_count: 0,
            success_count: 0,
          });
        }
        const stats = templateStats.get(key);
        stats.sent_count++;

        if (
          f.tracked_email?.responded_at &&
          f.sent_at &&
          new Date(f.tracked_email.responded_at) > new Date(f.sent_at)
        ) {
          stats.success_count++;
        }
      }
    });

    const by_template = Array.from(templateStats.values()).map(stats => ({
      template_id: stats.template_id,
      template_name: stats.template_name,
      sent_count: stats.sent_count,
      success_rate:
        stats.sent_count > 0
          ? (stats.success_count / stats.sent_count) * 100
          : 0,
    }));

    // Statistiques par numéro de relance
    const followupNumberStats = new Map();
    [1, 2, 3].forEach(num => {
      const followupsForNumber = data.filter(
        f => f.followup_number === num && f.status === "sent"
      );
      const successForNumber = followupsForNumber.filter(
        f =>
          f.tracked_email?.responded_at &&
          f.sent_at &&
          new Date(f.tracked_email.responded_at) > new Date(f.sent_at)
      );

      followupNumberStats.set(num, {
        followup_number: num,
        sent_count: followupsForNumber.length,
        success_rate:
          followupsForNumber.length > 0
            ? (successForNumber.length / followupsForNumber.length) * 100
            : 0,
      });
    });

    const by_followup_number = Array.from(followupNumberStats.values());

    return {
      total_sent,
      total_scheduled,
      total_failed,
      total_cancelled,
      success_rate: Math.round(success_rate * 100) / 100,
      average_response_time_hours:
        Math.round(average_response_time_hours * 100) / 100,
      by_template,
      by_followup_number,
    };
  }
}

// Instance par défaut pour l'utilisation côté client
export const followupService = new FollowupService();

// Factory pour utilisation côté serveur
export const createServerFollowupService = (
  supabaseClient?: ReturnType<typeof createClient>
) => new FollowupService(supabaseClient);
