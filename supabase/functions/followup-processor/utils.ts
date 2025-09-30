/**
 * Utilitaires pour followup-processor
 * Fonctions réutilisables pour l'authentification et la conversion
 */

// Configuration Microsoft
const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')!
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')!
const MICROSOFT_TENANT_ID = Deno.env.get('MICROSOFT_TENANT_ID')!

/**
 * Obtient un token d'accès Microsoft Graph avec permissions Application
 * @returns Token d'accès valide pour l'API Microsoft Graph
 * @throws Error si la requête échoue
 */
export async function getMicrosoftGraphToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`

  const params = new URLSearchParams()
  params.append('client_id', MICROSOFT_CLIENT_ID)
  params.append('client_secret', MICROSOFT_CLIENT_SECRET)
  params.append('scope', 'https://graph.microsoft.com/.default')
  params.append('grant_type', 'client_credentials')

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to get Microsoft Graph token: ${response.status} ${errorText}`)
  }

  const tokenData = await response.json()
  return tokenData.access_token
}

/**
 * Convertit du texte simple en HTML avec paragraphes et sauts de ligne
 * @param text Texte à convertir
 * @returns HTML formaté
 */
export function convertTextToHtml(text: string): string {
  return text
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
}

/**
 * Extrait le nom depuis une adresse email
 * Convertit le local part en nom formaté (first.last -> First Last)
 * @param email Adresse email
 * @returns Nom extrait et formaté
 */
export function extractNameFromEmail(email: string): string {
  const localPart = email.split('@')[0]
  return localPart
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Extrait le nom de l'entreprise depuis une adresse email
 * Utilise le domaine principal avant le TLD
 * @param email Adresse email
 * @returns Nom de l'entreprise extrait et formaté
 */
export function extractCompanyFromEmail(email: string): string {
  const domain = email.split('@')[1]
  if (!domain) return 'Entreprise'

  const company = domain.split('.')[0]
  return company.charAt(0).toUpperCase() + company.slice(1)
}