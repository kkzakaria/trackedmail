import {
  EdgeSupabaseClient,
  FollowupTemplateRow,
  TrackedEmailWithFollowupInfo,
  RenderedTemplate,
  TemplateVariables,
} from "./shared-types.ts";

/**
 * Récupère les templates actifs triés par ordre de relance
 */
export async function getActiveTemplates(
  supabase: EdgeSupabaseClient
): Promise<FollowupTemplateRow[]> {
  const { data, error } = await supabase
    .from("followup_templates")
    .select("*")
    .eq("is_active", true)
    .order("followup_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch active templates: ${error.message}`);
  }

  return data || [];
}

/**
 * Rend un template avec les variables dynamiques de l'email
 */
export function renderTemplate(
  template: FollowupTemplateRow,
  email: TrackedEmailWithFollowupInfo
): RenderedTemplate {
  // Construire les variables disponibles pour le template
  const variables: TemplateVariables = {
    destinataire_nom: extractNameFromEmail(email.recipient_emails[0] || ""),
    destinataire_entreprise: extractCompanyFromEmail(
      email.recipient_emails[0] || ""
    ),
    objet_original: email.subject,
    date_envoi_original: new Date(email.sent_at).toLocaleDateString("fr-FR"),
    numero_relance: template.followup_number,
    jours_depuis_envoi: Math.floor(
      (Date.now() - new Date(email.sent_at).getTime()) / (1000 * 60 * 60 * 24)
    ),
    expediteur_nom: extractNameFromEmail(email.sender_email),
    expediteur_email: email.sender_email,
  };

  // Rendre le sujet et le corps avec les variables
  let renderedSubject = template.subject;
  let renderedBody = template.body;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    renderedSubject = renderedSubject.replace(regex, String(value));
    renderedBody = renderedBody.replace(regex, String(value));
  });

  return {
    subject: renderedSubject,
    body: renderedBody,
  };
}

/**
 * Extrait le nom depuis une adresse email
 * Ex: "john.doe@company.com" → "John Doe"
 */
export function extractNameFromEmail(email: string): string {
  const localPart = email.split("@")[0];
  return localPart
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Extrait le nom de l'entreprise depuis une adresse email
 * Ex: "user@acmecorp.com" → "Acmecorp"
 */
export function extractCompanyFromEmail(email: string): string {
  const domain = email.split("@")[1];
  if (!domain) return "Entreprise";

  const company = domain.split(".")[0];
  return company.charAt(0).toUpperCase() + company.slice(1);
}

/**
 * Valide qu'un template contient toutes les variables requises
 */
export function validateTemplate(template: FollowupTemplateRow): string[] {
  const errors: string[] = [];

  if (!template.subject || template.subject.trim() === "") {
    errors.push("Subject is required");
  }

  if (!template.body || template.body.trim() === "") {
    errors.push("Body is required");
  }

  if (template.followup_number < 1 || template.followup_number > 10) {
    errors.push("Followup number must be between 1 and 10");
  }

  if (template.delay_hours < 1) {
    errors.push("Delay hours must be positive");
  }

  return errors;
}

/**
 * Extrait toutes les variables utilisées dans un template
 */
export function extractTemplateVariables(
  template: FollowupTemplateRow
): string[] {
  const text = `${template.subject} ${template.body}`;
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}
