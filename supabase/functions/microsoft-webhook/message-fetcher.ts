/**
 * Module pour interagir avec Microsoft Graph API
 */

import { EmailMessage } from './shared-types.ts'

/**
 * Récupère les détails d'un message via Microsoft Graph
 */
export async function getMessageDetails(
  userId: string,
  messageId: string
): Promise<EmailMessage | null> {
  try {
    console.log(`Fetching message details for user ${userId}, message ${messageId}`)

    // Obtenir un token d'accès valide
    const accessToken = await getAccessToken()
    if (!accessToken) {
      console.error('Failed to get access token for message details')
      return null
    }

    // Récupérer les détails du message via Microsoft Graph API
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${userId}/messages/${messageId}`
    const queryParams = new URLSearchParams({
      '$select': 'id,conversationId,conversationIndex,internetMessageId,subject,sender,toRecipients,ccRecipients,sentDateTime,hasAttachments,importance,bodyPreview,body,internetMessageHeaders'
    })

    const fullUrl = `${graphUrl}?${queryParams}`
    console.log('Microsoft Graph API URL:', fullUrl)

    const messageResponse = await fetch(fullUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text()
      console.error(`Failed to fetch message details: ${messageResponse.status} ${messageResponse.statusText}`)
      console.error('Error response:', errorText)
      return null
    }

    const messageData = await messageResponse.json()
    return transformToEmailMessage(messageData)

  } catch (error) {
    console.error(`Error fetching message details:`, error)
    return null
  }
}

/**
 * Obtient un token d'accès via l'Edge Function microsoft-auth
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const tokenResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          action: 'acquire'
        })
      }
    )

    if (!tokenResponse.ok) {
      console.error('Failed to get access token:', tokenResponse.status)
      return null
    }

    const tokenData = await tokenResponse.json()
    if (!tokenData.success || !tokenData.access_token) {
      console.error('Invalid token response:', tokenData)
      return null
    }

    return tokenData.access_token
  } catch (error) {
    console.error('Error getting access token:', error)
    return null
  }
}

/**
 * Transforme la réponse Microsoft Graph en format EmailMessage
 */
function transformToEmailMessage(messageData: any): EmailMessage {
  return {
    id: messageData.id,
    conversationId: messageData.conversationId,
    conversationIndex: messageData.conversationIndex,
    internetMessageId: messageData.internetMessageId,
    subject: messageData.subject || '',
    sender: {
      emailAddress: {
        name: messageData.sender?.emailAddress?.name || '',
        address: messageData.sender?.emailAddress?.address || ''
      }
    },
    toRecipients: transformRecipients(messageData.toRecipients),
    ccRecipients: transformRecipients(messageData.ccRecipients),
    sentDateTime: messageData.sentDateTime,
    hasAttachments: messageData.hasAttachments || false,
    importance: messageData.importance || 'normal',
    bodyPreview: messageData.bodyPreview || '',
    inReplyTo: extractInReplyTo(messageData.internetMessageHeaders),
    references: extractReferences(messageData.internetMessageHeaders),
    internetMessageHeaders: messageData.internetMessageHeaders || []
  }
}

/**
 * Transforme les destinataires
 */
function transformRecipients(
  recipients?: Array<{ emailAddress: { name?: string; address: string } }>
): Array<{ emailAddress: { name: string; address: string } }> {
  if (!recipients) return []

  return recipients.map(recipient => ({
    emailAddress: {
      name: recipient.emailAddress?.name || '',
      address: recipient.emailAddress?.address || ''
    }
  }))
}

/**
 * Extrait le header In-Reply-To
 */
function extractInReplyTo(headers?: Array<{name: string, value: string}>): string | undefined {
  if (!headers) return undefined

  const inReplyToHeader = headers.find(
    h => h.name.toLowerCase() === 'in-reply-to'
  )
  return inReplyToHeader?.value
}

/**
 * Extrait le header References
 */
function extractReferences(headers?: Array<{name: string, value: string}>): string | undefined {
  if (!headers) return undefined

  const referencesHeader = headers.find(
    h => h.name.toLowerCase() === 'references'
  )
  return referencesHeader?.value
}

/**
 * Vérifie si un message existe dans le dossier SentItems
 * @deprecated - Remplacé par la classification basée sur l'expéditeur
 */
export async function isMessageInSentFolder(
  userId: string,
  messageId: string
): Promise<boolean> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    console.warn('No access token available for folder check')
    return false
  }

  try {
    // Approche directe : essayer de récupérer le message depuis le dossier SentItems
    const sentItemsUrl = `https://graph.microsoft.com/v1.0/users/${userId}/mailFolders('SentItems')/messages/${messageId}?$select=id`
    console.log(`Checking if message is in SentItems folder: ${sentItemsUrl}`)

    const sentItemsResponse = await fetch(sentItemsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const isInSentItems = sentItemsResponse.ok
    console.log(`Message ${messageId} is in SentItems folder: ${isInSentItems}`)

    if (!isInSentItems) {
      // Log de l'erreur pour comprendre pourquoi ce n'est pas dans SentItems
      const errorText = await sentItemsResponse.text()
      console.log(`SentItems check failed (${sentItemsResponse.status}): ${errorText}`)
    }

    return isInSentItems

  } catch (error) {
    console.error('Error checking if message is from sent folder:', error)
    return false
  }
}