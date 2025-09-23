import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database.types";
import {
  FollowupTemplateWithStats,
  TemplateVariables,
  TemplateRenderParams,
  TemplateValidationResult,
  PaginationParams,
  PaginatedResult,
  SimpleFollowupStats,
} from "@/lib/types/followup.types";

export class FollowupTemplateService {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseClient?: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient || createClient();
  }

  /**
   * Récupère la liste des templates avec pagination et filtres
   */
  async getTemplates(params?: {
    pagination?: PaginationParams;
    filters?: {
      is_active?: boolean;
      followup_number?: number;
      search_query?: string;
    };
    include_stats?: boolean;
  }): Promise<
    PaginatedResult<
      | Database["public"]["Tables"]["followup_templates"]["Row"]
      | FollowupTemplateWithStats
    >
  > {
    let query = this.supabase
      .from("followup_templates")
      .select("*", { count: "exact" });

    // Filtres
    if (params?.filters?.is_active !== undefined) {
      query = query.eq("is_active", params.filters.is_active);
    }

    if (params?.filters?.followup_number) {
      query = query.eq("followup_number", params.filters.followup_number);
    }

    if (params?.filters?.search_query) {
      query = query.or(
        `name.ilike.%${params.filters.search_query}%,subject.ilike.%${params.filters.search_query}%`
      );
    }

    // Tri
    const sortBy = params?.pagination?.sort_by || "created_at";
    const sortOrder = params?.pagination?.sort_order || "desc";
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Pagination
    const page = params?.pagination?.page || 1;
    const perPage = params?.pagination?.per_page || 10;
    const offset = (page - 1) * perPage;

    query = query.range(offset, offset + perPage - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(
        `Erreur lors de la récupération des templates: ${error.message}`
      );
    }

    // Ajouter les statistiques si demandées
    let templatesWithStats = data;
    if (params?.include_stats && data) {
      templatesWithStats = await this.addStatsToTemplates(data);
    }

    return {
      data: templatesWithStats || [],
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
   * Récupère un template par son ID
   */
  async getTemplateById(
    id: string
  ): Promise<Database["public"]["Tables"]["followup_templates"]["Row"] | null> {
    const { data, error } = await this.supabase
      .from("followup_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Template non trouvé
      }
      throw new Error(
        `Erreur lors de la récupération du template: ${error.message}`
      );
    }

    return data;
  }

  /**
   * Récupère le template actif pour un niveau de relance donné
   */
  async getActiveTemplateByNumber(
    followupNumber: number
  ): Promise<Database["public"]["Tables"]["followup_templates"]["Row"] | null> {
    const { data, error } = await this.supabase
      .from("followup_templates")
      .select("*")
      .eq("followup_number", followupNumber)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Aucun template actif pour ce niveau
      }
      throw new Error(
        `Erreur lors de la récupération du template actif: ${error.message}`
      );
    }

    return data;
  }

  /**
   * Crée un nouveau template
   */
  async createTemplate(
    templateData: Database["public"]["Tables"]["followup_templates"]["Insert"]
  ): Promise<Database["public"]["Tables"]["followup_templates"]["Row"]> {
    // Validation des données
    const validationResult = await this.validateTemplate(templateData);
    if (!validationResult.is_valid) {
      throw new Error(
        `Template invalide: ${validationResult.errors.join(", ")}`
      );
    }

    // Si le template est marqué comme actif, désactiver les autres templates du même niveau
    if (templateData.is_active) {
      await this.deactivateOtherTemplates(templateData.followup_number);
    }

    const { data, error } = await this.supabase
      .from("followup_templates")
      .insert(templateData)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Erreur lors de la création du template: ${error.message}`
      );
    }

    return data;
  }

  /**
   * Met à jour un template existant
   */
  async updateTemplate(
    id: string,
    updates: Database["public"]["Tables"]["followup_templates"]["Update"]
  ): Promise<Database["public"]["Tables"]["followup_templates"]["Row"]> {
    // Récupérer le template existant
    const existingTemplate = await this.getTemplateById(id);
    if (!existingTemplate) {
      throw new Error("Template non trouvé");
    }

    // Validation des données mises à jour
    const updatedTemplate = { ...existingTemplate, ...updates };
    const validationResult = await this.validateTemplate(updatedTemplate);
    if (!validationResult.is_valid) {
      throw new Error(
        `Template invalide: ${validationResult.errors.join(", ")}`
      );
    }

    // Si le template est marqué comme actif, désactiver les autres templates du même niveau
    if (updates.is_active && updates.followup_number) {
      await this.deactivateOtherTemplates(updates.followup_number, id);
    }

    // Incrémenter la version
    if (updates.subject || updates.body) {
      updates.version = (existingTemplate.version || 1) + 1;
    }

    const { data, error } = await this.supabase
      .from("followup_templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Erreur lors de la mise à jour du template: ${error.message}`
      );
    }

    return data;
  }

  /**
   * Active ou désactive un template
   */
  async toggleTemplateStatus(
    id: string,
    isActive: boolean
  ): Promise<Database["public"]["Tables"]["followup_templates"]["Row"]> {
    const template = await this.getTemplateById(id);
    if (!template) {
      throw new Error("Template non trouvé");
    }

    // Si on active le template, désactiver les autres du même niveau
    if (isActive) {
      await this.deactivateOtherTemplates(template.followup_number, id);
    }

    return this.updateTemplate(id, { is_active: isActive });
  }

  /**
   * Supprime un template
   */
  async deleteTemplate(id: string): Promise<void> {
    // Vérifier que le template n'est pas utilisé dans des relances programmées
    const { data: followups, error: followupsError } = await this.supabase
      .from("followups")
      .select("id")
      .eq("template_id", id)
      .eq("status", "scheduled")
      .limit(1);

    if (followupsError) {
      throw new Error(
        `Erreur lors de la vérification des relances: ${followupsError.message}`
      );
    }

    if (followups && followups.length > 0) {
      throw new Error(
        "Impossible de supprimer un template utilisé dans des relances programmées"
      );
    }

    const { error } = await this.supabase
      .from("followup_templates")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(
        `Erreur lors de la suppression du template: ${error.message}`
      );
    }
  }

  /**
   * Rend un template avec les variables dynamiques
   */
  async renderTemplate(
    params: TemplateRenderParams
  ): Promise<{ subject: string; body: string }> {
    const { template, variables, tracked_email_id } = params;

    // Récupérer les données de l'email suivi si nécessaire
    let emailData = null;
    if (tracked_email_id) {
      const { data, error } = await this.supabase
        .from("tracked_emails")
        .select(
          `
          *,
          mailbox:mailboxes!inner(email_address, display_name)
        `
        )
        .eq("id", tracked_email_id)
        .single();

      if (!error && data) {
        emailData = data;
      }
    }

    // Construire les variables complètes
    const completeVariables = this.buildCompleteVariables(
      variables,
      emailData || undefined
    );

    // Rendre le sujet et le corps
    const renderedSubject = this.renderString(
      template.subject,
      completeVariables
    );
    const renderedBody = this.renderString(template.body, completeVariables);

    return {
      subject: renderedSubject,
      body: renderedBody,
    };
  }

  /**
   * Valide un template
   */
  async validateTemplate(
    template: Partial<Database["public"]["Tables"]["followup_templates"]["Row"]>
  ): Promise<TemplateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validations obligatoires
    if (!template.name?.trim()) {
      errors.push("Le nom du template est obligatoire");
    }

    if (!template.subject?.trim()) {
      errors.push("Le sujet est obligatoire");
    }

    if (!template.body?.trim()) {
      errors.push("Le corps du message est obligatoire");
    }

    if (
      !template.followup_number ||
      template.followup_number < 1 ||
      template.followup_number > 3
    ) {
      errors.push("Le numéro de relance doit être entre 1 et 3");
    }

    if (!template.delay_hours || template.delay_hours < 1) {
      errors.push("Le délai doit être d'au moins 1 heure");
    }

    // Validation des variables dans le template
    if (template.subject || template.body) {
      const usedVariables = this.extractVariables(
        `${template.subject} ${template.body}`
      );
      const availableVariables =
        template.available_variables || this.getDefaultAvailableVariables();

      const invalidVariables = usedVariables.filter(
        variable => !availableVariables.includes(variable)
      );

      if (invalidVariables.length > 0) {
        errors.push(`Variables non reconnues: ${invalidVariables.join(", ")}`);
      }
    }

    // Vérification de l'unicité du template actif par niveau
    if (template.is_active && template.followup_number) {
      const { data: existingActiveTemplate } = await this.supabase
        .from("followup_templates")
        .select("id, name")
        .eq("followup_number", template.followup_number)
        .eq("is_active", true)
        .limit(1);

      if (existingActiveTemplate && existingActiveTemplate.length > 0) {
        const existingTemplate = existingActiveTemplate[0];
        // Ignorer le template actuel lors de la mise à jour
        if (existingTemplate && template.id !== existingTemplate.id) {
          warnings.push(
            `Un template actif existe déjà pour la relance ${template.followup_number}: ${existingTemplate.name}`
          );
        }
      }
    }

    // Générer un aperçu si le template est valide
    let rendered_preview;
    if (errors.length === 0 && template.subject && template.body) {
      try {
        const mockVariables = this.getMockVariables();
        rendered_preview = {
          subject: this.renderString(template.subject, mockVariables),
          body: this.renderString(template.body, mockVariables),
        };
      } catch {
        warnings.push("Impossible de générer l'aperçu du template");
      }
    }

    const result: TemplateValidationResult = {
      is_valid: errors.length === 0,
      errors,
      warnings,
    };

    if (rendered_preview) {
      result.rendered_preview = rendered_preview;
    }

    return result;
  }

  /**
   * Récupère les templates par défaut pour l'initialisation
   */
  async getDefaultTemplates(): Promise<
    Database["public"]["Tables"]["followup_templates"]["Insert"][]
  > {
    return [
      {
        name: "Première relance - Amicale",
        subject: "Re: {{objet_original}}",
        body: `Bonjour {{destinataire_nom}},

J'espère que vous allez bien. Je reviens vers vous concernant mon email du {{date_envoi_original}}.

Il est possible que mon message soit passé inaperçu dans votre boîte de réception. Pourriez-vous me faire savoir si vous avez eu l'occasion de le consulter ?

Je reste à votre disposition pour toute question.

Cordialement`,
        followup_number: 1,
        delay_hours: 96, // 4 jours
        is_active: true,
      },
      {
        name: "Deuxième relance - Rappel",
        subject: "Re: {{objet_original}} - Rappel",
        body: `Bonjour {{destinataire_nom}},

Cela fait maintenant {{jours_depuis_envoi}} jours que je vous ai contacté(e) sans avoir de retour de votre part.

Je comprends que vous puissiez être occupé(e), mais j'aimerais savoir si vous êtes toujours intéressé(e) par ma proposition.

Une réponse rapide, même brève, serait très appréciée.

Cordialement`,
        followup_number: 2,
        delay_hours: 96, // 4 jours
        is_active: true,
      },
      {
        name: "Troisième relance - Dernière tentative",
        subject: "Re: {{objet_original}} - Dernière relance",
        body: `Bonjour {{destinataire_nom}},

Ceci est ma dernière relance concernant mon email du {{date_envoi_original}}.

Si vous n'êtes pas intéressé(e) ou si le timing n'est pas approprié, n'hésitez pas à me le faire savoir. Dans le cas contraire, je considérerai que le sujet ne vous intéresse pas et je ne vous recontacterai plus à ce propos.

Merci pour votre temps.

Cordialement`,
        followup_number: 3,
        delay_hours: 168, // 7 jours
        is_active: true,
      },
    ];
  }

  // Méthodes privées utilitaires

  private async deactivateOtherTemplates(
    followupNumber: number,
    excludeId?: string
  ): Promise<void> {
    let query = this.supabase
      .from("followup_templates")
      .update({ is_active: false })
      .eq("followup_number", followupNumber)
      .eq("is_active", true);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(
        `Erreur lors de la désactivation des autres templates: ${error.message}`
      );
    }
  }

  private async addStatsToTemplates(
    templates: Database["public"]["Tables"]["followup_templates"]["Row"][]
  ): Promise<FollowupTemplateWithStats[]> {
    const templateIds = templates.map(t => t.id);

    // Récupérer les statistiques d'utilisation
    const { data: followupStats, error } = await this.supabase
      .from("followups")
      .select("template_id, status")
      .in("template_id", templateIds);

    if (error) {
      return templates; // Retourner sans stats en cas d'erreur
    }

    return templates.map(template => {
      const templateFollowups =
        followupStats?.filter(
          (f: SimpleFollowupStats) => f.template_id === template.id
        ) || [];
      const sentFollowups = templateFollowups.filter(
        (f: SimpleFollowupStats) => f.status === "sent"
      );

      return {
        ...template,
        usage_count: templateFollowups.length,
        success_rate:
          templateFollowups.length > 0
            ? Math.round(
                (sentFollowups.length / templateFollowups.length) * 100
              )
            : 0,
      };
    });
  }

  private buildCompleteVariables(
    provided: Partial<TemplateVariables>,
    emailData?: Database["public"]["Tables"]["tracked_emails"]["Row"]
  ): TemplateVariables {
    const defaultVariables = this.getMockVariables();

    if (emailData) {
      // Extraire le nom du destinataire principal
      const recipientEmail = emailData.recipient_emails?.[0] || "";
      const recipientName = this.extractNameFromEmail(recipientEmail);
      const recipientCompany = this.extractCompanyFromEmail(recipientEmail);

      // Calculer les jours depuis l'envoi
      const sentDate = new Date(emailData.sent_at);
      const daysSince = Math.floor(
        (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        destinataire_nom: recipientName,
        destinataire_entreprise: recipientCompany,
        objet_original: emailData.subject,
        date_envoi_original: sentDate.toLocaleDateString("fr-FR"),
        numero_relance: provided.numero_relance || 1,
        jours_depuis_envoi: daysSince,
        expediteur_nom: this.extractNameFromEmail(emailData.sender_email),
        expediteur_email: emailData.sender_email,
        ...provided,
      };
    }

    return { ...defaultVariables, ...provided };
  }

  private renderString(template: string, variables: TemplateVariables): string {
    let rendered = template;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      rendered = rendered.replace(regex, String(value));
    });

    return rendered;
  }

  private extractVariables(text: string): string[] {
    const regex = /{{(\w+)}}/g;
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        matches.push(match[1]);
      }
    }

    return [...new Set(matches)]; // Supprimer les doublons
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

  private extractCompanyFromEmail(email: string): string {
    const domain = email.split("@")[1];
    if (!domain) return "Entreprise";

    const company = domain.split(".")[0];
    if (!company) return "Entreprise";
    return company.charAt(0).toUpperCase() + company.slice(1);
  }

  private getDefaultAvailableVariables(): string[] {
    return [
      "destinataire_nom",
      "destinataire_entreprise",
      "objet_original",
      "date_envoi_original",
      "numero_relance",
      "jours_depuis_envoi",
      "expediteur_nom",
      "expediteur_email",
    ];
  }

  private getMockVariables(): TemplateVariables {
    return {
      destinataire_nom: "Jean Dupont",
      destinataire_entreprise: "Exemple Corp",
      objet_original: "Proposition de collaboration",
      date_envoi_original: new Date().toLocaleDateString("fr-FR"),
      numero_relance: 1,
      jours_depuis_envoi: 4,
      expediteur_nom: "Marie Martin",
      expediteur_email: "marie.martin@monentreprise.com",
    };
  }
}

// Instance par défaut pour l'utilisation côté client
export const followupTemplateService = new FollowupTemplateService();

// Factory pour utilisation côté serveur
export const createServerFollowupTemplateService = (
  supabaseClient?: ReturnType<typeof createClient>
) => new FollowupTemplateService(supabaseClient);
