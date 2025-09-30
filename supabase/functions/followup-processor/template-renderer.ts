/**
 * Rendu des templates de relance
 * Gestion des variables et substitution dans les templates
 */

import type { EmailEligibleForSlot, FollowupTemplate, RenderedTemplate, TemplateVariables } from './shared-types.ts'
import { extractNameFromEmail, extractCompanyFromEmail } from './utils.ts'

/**
 * Rend un template avec les variables de l'email
 * Supporte les variables en français et en anglais pour compatibilité
 * @param template Template à rendre
 * @param email Email contenant les données pour les variables
 * @returns Template rendu avec subject et body
 */
export function renderTemplate(
  template: FollowupTemplate,
  email: EmailEligibleForSlot
): RenderedTemplate {
  const variables = buildTemplateVariables(email, template.followup_number)

  let renderedSubject = template.subject
  let renderedBody = template.body

  // Remplacer toutes les variables
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    renderedSubject = renderedSubject.replace(regex, String(value))
    renderedBody = renderedBody.replace(regex, String(value))
  })

  return {
    subject: renderedSubject,
    body: renderedBody
  }
}

/**
 * Construit les variables disponibles pour le rendu des templates
 * @param email Email source des données
 * @param followupNumber Numéro de la relance actuelle
 * @returns Objet avec toutes les variables disponibles
 */
function buildTemplateVariables(
  email: EmailEligibleForSlot,
  followupNumber: number
): TemplateVariables {
  const recipientEmail = email.recipient_emails[0] || ''
  const daysSinceSent = Math.floor(
    (Date.now() - new Date(email.sent_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    // Variables françaises (pour compatibilité avec templates existants)
    destinataire_nom: extractNameFromEmail(recipientEmail),
    destinataire_entreprise: extractCompanyFromEmail(recipientEmail),
    objet_original: email.subject,
    date_envoi_original: new Date(email.sent_at).toLocaleDateString('fr-FR'),
    numero_relance: followupNumber,
    jours_depuis_envoi: daysSinceSent,
    expediteur_nom: extractNameFromEmail(email.sender_email),
    expediteur_email: email.sender_email,
    // Variables anglaises (pour templates qui utilisent la nomenclature anglaise)
    recipient_name: extractNameFromEmail(recipientEmail),
    recipient_company: extractCompanyFromEmail(recipientEmail),
    original_subject: email.subject,
    original_message: email.body_preview || 'Message précédent non disponible',
    sender_name: extractNameFromEmail(email.sender_email),
    sender_email: email.sender_email
  }
}