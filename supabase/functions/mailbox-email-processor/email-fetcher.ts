/**
 * Module de récupération d'emails depuis Microsoft Graph
 * Responsable de la communication avec l'API Microsoft Graph pour récupérer les emails
 */

import { GraphEmail } from './enhanced-processor.ts'

/**
 * Récupère les emails d'une mailbox via Microsoft Graph
 */
export async function fetchMailboxEmails(
  microsoftUserId: string,
  startDate: string,
  endDate: string,
  accessToken: string
): Promise<GraphEmail[]> {
  const emails: GraphEmail[] = []
  let nextLink: string | null = null

  try {
    console.log(`📬 Fetching emails for user ${microsoftUserId} from ${startDate} to ${endDate}`)

    do {
      // Construire l'URL de requête avec filtres de date
      let url: string

      if (nextLink) {
        url = nextLink
      } else {
        // Filtrer par date d'envoi et sélectionner les champs nécessaires
        const filter = `sentDateTime ge ${startDate} and sentDateTime lt ${endDate}`
        const select = 'id,conversationId,conversationIndex,internetMessageId,subject,sender,toRecipients,ccRecipients,sentDateTime,hasAttachments,importance,bodyPreview,internetMessageHeaders,parentFolderId,isDraft,isRead'

        url = `https://graph.microsoft.com/v1.0/users/${microsoftUserId}/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=1000&$orderby=sentDateTime desc`
      }

      console.log(`🔗 API Request: ${url.split('?')[0]}`)

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()

      if (data.value && Array.isArray(data.value)) {
        // Filtrer les brouillons et emails non finalisés
        const validEmails = data.value
          .filter((email: GraphEmail) => !email.isDraft)
          .map((email: GraphEmail) => ({
            ...email,
            // S'assurer que tous les champs requis sont présents
            conversationIndex: email.conversationIndex || undefined,
            ccRecipients: email.ccRecipients || [],
            inReplyTo: extractHeaderValue(email.internetMessageHeaders, 'In-Reply-To'),
            references: extractHeaderValue(email.internetMessageHeaders, 'References'),
            internetMessageHeaders: email.internetMessageHeaders || []
          }))

        emails.push(...validEmails)
        console.log(`📥 Fetched ${validEmails.length} valid emails (${data.value.length} total, ${data.value.length - validEmails.length} drafts excluded)`)
      }

      // Vérifier s'il y a une page suivante
      nextLink = data['@odata.nextLink'] || null

    } while (nextLink)

    console.log(`✅ Total emails fetched for user ${microsoftUserId}: ${emails.length}`)
    return emails

  } catch (error) {
    console.error(`❌ Error fetching emails for user ${microsoftUserId}:`, error)
    throw error
  }
}

/**
 * Extrait une valeur d'header depuis internetMessageHeaders
 */
function extractHeaderValue(
  headers: Array<{name: string, value: string}> | undefined,
  headerName: string
): string | undefined {
  if (!headers || headers.length === 0) {
    return undefined
  }

  const header = headers.find(h => h.name.toLowerCase() === headerName.toLowerCase())
  return header?.value
}