/**
 * Edge Function - Microsoft Graph Webhook Handler
 *
 * Reçoit et traite les notifications webhook de Microsoft Graph
 * Détecte automatiquement les nouveaux emails envoyés et les insère dans tracked_emails
 * Gère la validation de sécurité et la détection de threading
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  EdgeSupabaseClient,
  MailboxRow
} from '../_shared/types.ts'

console.log('Microsoft Graph Webhook Handler - Ready!')

/**
 * Interface pour les notifications webhook Microsoft Graph
 */
interface MicrosoftGraphWebhookNotification {
  subscriptionId: string
  changeType: 'created' | 'updated' | 'deleted'
  tenantId: string
  clientState: string
  subscriptionExpirationDateTime: string
  resource: string
  resourceData: {
    '@odata.type': string
    '@odata.id': string
    '@odata.etag'?: string
    id: string
  }
}

interface WebhookPayload {
  value: MicrosoftGraphWebhookNotification[]
  validationTokens?: string[]
}

interface EmailMessage {
  id: string
  conversationId: string
  conversationIndex?: string
  internetMessageId: string
  subject: string
  sender: {
    emailAddress: {
      name: string
      address: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  ccRecipients?: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  sentDateTime: string
  hasAttachments: boolean
  importance: 'low' | 'normal' | 'high'
  bodyPreview: string
  inReplyTo?: string
  references?: string
  internetMessageHeaders?: Array<{
    name: string
    value: string
  }>
}

/**
 * Configuration tenant pour exclusion emails internes
 */
interface TenantConfig {
  domain: string
  microsoft_tenant_id: string
  exclude_internal_emails: boolean
}

/**
 * Handler principal de l'Edge Function
 */
Deno.serve(async (req) => {
  // Configuration Supabase
  const supabase: EdgeSupabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier s'il y a un validationToken dans l'URL (GET ou POST)
  const url = new URL(req.url)
  const validationToken = url.searchParams.get('validationToken')

  if (validationToken) {
    console.log(`[VALIDATION] ${req.method} validation request detected`)
    console.log(`[VALIDATION] Token: ${validationToken}`)
    console.log(`[VALIDATION] Headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`)
    console.log(`[VALIDATION] URL: ${req.url}`)
    console.log(`[VALIDATION] All query params: ${JSON.stringify(Object.fromEntries(url.searchParams.entries()))}`)

    console.log(`[VALIDATION] Returning validation token: ${validationToken}`)
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  // Gestion de la validation GET (fallback)
  if (req.method === 'GET') {
    console.log('[VALIDATION] GET request without validation token, returning OK')
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  // Gestion de TOUTES les autres requêtes (pour diagnostic)
  console.log(`[DEBUG] ${req.method} request received`)
  console.log(`[DEBUG] Headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`)
  console.log(`[DEBUG] URL: ${req.url}`)

  // Vérification de la méthode HTTP pour les notifications
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Lecture du payload pour les notifications POST
    const contentType = req.headers.get('content-type')
    let payload: WebhookPayload

    if (contentType && contentType.includes('application/json')) {
      // Vérifier si le body n'est pas vide
      const text = await req.text()
      if (!text || text.trim() === '') {
        console.log('Received empty body, treating as ping request')
        return new Response(
          JSON.stringify({ message: 'Webhook endpoint is ready' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      try {
        payload = JSON.parse(text)
      } catch (parseError) {
        console.error('Failed to parse JSON payload:', parseError)
        return new Response(
          JSON.stringify({ error: 'Invalid JSON payload' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      // Si pas de body JSON, retourner une erreur
      return new Response(
        JSON.stringify({ error: 'Invalid content type, expected application/json' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Gestion de la validation via POST (format alternatif)
    if (payload.validationTokens && payload.validationTokens.length > 0) {
      console.log('Webhook validation requested via POST')
      return new Response(payload.validationTokens[0], {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    // Vérification de la sécurité
    const isValid = validateWebhookSecurity(req, payload)
    if (!isValid) {
      console.warn('Webhook security validation failed')
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature or client state' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Log de réception webhook
    await logWebhookEvent(supabase, payload, req)

    // Traitement des notifications
    const results = await Promise.allSettled(
      payload.value.map(notification =>
        processNotification(supabase, notification)
      )
    )

    // Comptage des résultats
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`Processed ${payload.value.length} notifications: ${successful} successful, ${failed} failed`)

    // Réponse de succès
    return new Response(
      JSON.stringify({
        success: true,
        processed: payload.value.length,
        successful,
        failed
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error processing webhook:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Valide la sécurité du webhook
 */
function validateWebhookSecurity(
  _req: Request,
  payload: WebhookPayload
): boolean {
  try {
    const webhookSecret = Deno.env.get('MICROSOFT_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.warn('MICROSOFT_WEBHOOK_SECRET not configured')
      return false
    }

    // Vérification du client state si disponible
    if (payload.value && payload.value.length > 0) {
      const clientState = payload.value[0].clientState
      if (clientState !== webhookSecret) {
        console.warn('Invalid client state')
        return false
      }
    }

    // TODO: Ajouter validation de signature si nécessaire
    // Dans un environnement de production, valider aussi la signature du webhook

    return true
  } catch (error) {
    console.error('Error validating webhook security:', error)
    return false
  }
}

/**
 * Log l'événement webhook pour traçabilité
 */
async function logWebhookEvent(
  supabase: EdgeSupabaseClient,
  payload: WebhookPayload,
  req: Request
): Promise<void> {
  try {
    const userAgent = req.headers.get('User-Agent') || 'Unknown'
    const xForwardedFor = req.headers.get('X-Forwarded-For')

    await supabase
      .from('webhook_events')
      .insert({
        source: 'microsoft_graph',
        event_type: 'notification_received',
        payload: payload,
        headers: {
          'user-agent': userAgent,
          'x-forwarded-for': xForwardedFor
        },
        notification_count: payload.value?.length || 0
      })
  } catch (error) {
    console.warn('Failed to log webhook event:', error)
  }
}

/**
 * Traite une notification individuelle
 */
async function processNotification(
  supabase: EdgeSupabaseClient,
  notification: MicrosoftGraphWebhookNotification
): Promise<void> {
  console.log(`Processing notification: ${notification.changeType} for ${notification.resource}`)

  // Vérifier que c'est bien un message email (Microsoft Graph utilise 'Messages' avec M majuscule)
  if (!notification.resource.includes('/Messages/') && !notification.resource.includes('/messages/')) {
    console.log('Notification is not for an email message, skipping')
    console.log(`Resource received: ${notification.resource}`)
    return
  }

  // Seuls les emails créés nous intéressent pour le tracking
  if (notification.changeType !== 'created') {
    console.log(`Notification type ${notification.changeType} not relevant for tracking`)
    return
  }

  try {
    // Extraire l'ID du message et l'ID utilisateur depuis la resource
    // Microsoft Graph utilise 'Users' et 'Messages' avec majuscules
    const resourceParts = notification.resource.split('/')
    const userIdIndex = resourceParts.findIndex(part => part.toLowerCase() === 'users') + 1
    const messageIdIndex = resourceParts.findIndex(part => part.toLowerCase() === 'messages') + 1

    console.log(`Resource parts: ${JSON.stringify(resourceParts)}`)
    console.log(`User ID index: ${userIdIndex}, Message ID index: ${messageIdIndex}`)

    if (userIdIndex <= 0 || messageIdIndex <= 0) {
      throw new Error('Could not extract user ID and message ID from resource')
    }

    const userId = resourceParts[userIdIndex]
    const messageId = resourceParts[messageIdIndex]

    // Récupérer les détails du message via Microsoft Graph
    const messageDetails = await getMessageDetails(userId, messageId)

    if (!messageDetails) {
      console.warn(`Could not fetch message details for ${messageId}`)
      return
    }

    // Vérifier si l'email doit être exclu (email interne)
    const shouldExclude = await shouldExcludeEmail(supabase, messageDetails)
    if (shouldExclude) {
      console.log(`Email ${messageId} excluded (internal email)`)

      // Log de l'exclusion
      await logDetectionAttempt(supabase, messageDetails, false, null, 'not_detected', 'internal_email')
      return
    }

    // Vérifier si c'est un email depuis un dossier "Sent Items"
    // En récupérant les informations du dossier parent depuis Microsoft Graph
    const isSentEmail = await isFromSentFolder(userId, messageDetails.id, await getAccessToken())
    if (!isSentEmail) {
      console.log(`Email ${messageId} not from sent folder, skipping`)
      return
    }

    // Récupérer la mailbox correspondante
    const mailbox = await getMailboxByUserId(supabase, userId)
    if (!mailbox) {
      console.warn(`No mailbox found for user ${userId}`)
      return
    }

    // Vérifier si l'email n'existe pas déjà
    const existingEmail = await getExistingTrackedEmail(supabase, messageDetails.internetMessageId)
    if (existingEmail) {
      console.log(`Email ${messageDetails.internetMessageId} already tracked`)
      return
    }

    // Insérer l'email dans tracked_emails
    await insertTrackedEmail(supabase, messageDetails, mailbox.id)

    // Log de la détection réussie
    await logDetectionAttempt(supabase, messageDetails, true, null, 'conversation_id', null)

    console.log(`Successfully tracked new email: ${messageDetails.subject}`)

  } catch (error) {
    console.error('Error processing notification:', error)
    throw error
  }
}

/**
 * Récupère les détails d'un message via Microsoft Graph
 */
async function getMessageDetails(userId: string, messageId: string): Promise<EmailMessage | null> {
  try {
    console.log(`Fetching message details for user ${userId}, message ${messageId}`)

    // Obtenir un token d'accès valide via l'Edge Function microsoft-auth
    const tokenResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        action: 'acquire'
      })
    })

    if (!tokenResponse.ok) {
      console.error('Failed to get access token:', tokenResponse.status)
      return null
    }

    const tokenData = await tokenResponse.json()
    if (!tokenData.success || !tokenData.access_token) {
      console.error('Invalid token response:', tokenData)
      return null
    }

    const accessToken = tokenData.access_token

    // Récupérer les détails du message via Microsoft Graph API
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${userId}/messages/${messageId}?$select=id,conversationId,conversationIndex,internetMessageId,subject,sender,toRecipients,ccRecipients,sentDateTime,hasAttachments,importance,bodyPreview,body,internetMessageHeaders`
    console.log('Microsoft Graph API URL:', graphUrl)
    console.log('Access token length:', accessToken?.length)

    const messageResponse = await fetch(graphUrl, {
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

    // Transformer la réponse Microsoft Graph en format EmailMessage
    const emailMessage: EmailMessage = {
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
      toRecipients: messageData.toRecipients?.map((recipient: { emailAddress: { name?: string; address: string } }) => ({
        emailAddress: {
          name: recipient.emailAddress?.name || '',
          address: recipient.emailAddress?.address || ''
        }
      })) || [],
      ccRecipients: messageData.ccRecipients?.map((recipient: { emailAddress: { name?: string; address: string } }) => ({
        emailAddress: {
          name: recipient.emailAddress?.name || '',
          address: recipient.emailAddress?.address || ''
        }
      })) || [],
      sentDateTime: messageData.sentDateTime,
      hasAttachments: messageData.hasAttachments || false,
      importance: messageData.importance || 'normal',
      bodyPreview: messageData.bodyPreview || '',
      inReplyTo: messageData.inReplyTo,
      references: messageData.references,
      internetMessageHeaders: messageData.internetMessageHeaders || []
    }

    console.log(`Successfully fetched message details for ${messageId}`)
    return emailMessage

  } catch (error) {
    console.error(`Error fetching message details:`, error)
    return null
  }
}

/**
 * Vérifie si un email doit être exclu (email interne)
 */
async function shouldExcludeEmail(supabase: EdgeSupabaseClient, message: EmailMessage): Promise<boolean> {
  try {
    // Récupérer la configuration du tenant
    const { data: config } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'tenant_config')
      .single()

    if (!config?.value) {
      return false
    }

    const tenantConfig: TenantConfig = typeof config.value === 'string'
      ? JSON.parse(config.value)
      : config.value

    if (!tenantConfig.exclude_internal_emails || !tenantConfig.domain) {
      return false
    }

    // Vérifier si l'expéditeur est interne
    const senderDomain = message.sender.emailAddress.address.split('@')[1]
    if (senderDomain === tenantConfig.domain.replace('@', '')) {
      return true
    }

    return false
  } catch (error) {
    console.warn('Error checking if email should be excluded:', error)
    return false
  }
}

/**
 * Récupère un token d'accès depuis le service d'auth
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const tokenResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        action: 'acquire'
      })
    })

    if (!tokenResponse.ok) {
      console.error('Failed to get access token for folder check:', tokenResponse.status)
      return null
    }

    const tokenData = await tokenResponse.json()
    if (!tokenData.success || !tokenData.access_token) {
      console.error('Invalid token response for folder check:', tokenData)
      return null
    }

    return tokenData.access_token
  } catch (error) {
    console.error('Error getting access token for folder check:', error)
    return null
  }
}

/**
 * Vérifie si l'email provient du dossier "Sent Items" via Microsoft Graph API
 */
async function isFromSentFolder(userId: string, messageId: string, accessToken: string | null): Promise<boolean> {
  if (!accessToken) {
    console.warn('No access token available for folder check')
    return false
  }

  try {
    // Approche directe : essayer de récupérer le message depuis le dossier SentItems
    // Si la requête réussit, le message est dans le dossier SentItems
    const sentItemsUrl = `https://graph.microsoft.com/v1.0/users/${userId}/mailFolders('SentItems')/messages/${messageId}?$select=id`
    console.log(`Checking if message is in SentItems folder: ${sentItemsUrl}`)

    const sentItemsResponse = await fetch(
      sentItemsUrl,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

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

/**
 * Récupère la mailbox par user ID Microsoft
 */
async function getMailboxByUserId(supabase: EdgeSupabaseClient, microsoftUserId: string): Promise<MailboxRow | null> {
  try {
    const { data, error } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('microsoft_user_id', microsoftUserId)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data
  } catch (error) {
    console.error(`Error getting mailbox for user ${microsoftUserId}:`, error)
    return null
  }
}

/**
 * Vérifie si un email est déjà suivi
 */
async function getExistingTrackedEmail(supabase: EdgeSupabaseClient, internetMessageId: string): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabase
      .from('tracked_emails')
      .select('id')
      .eq('internet_message_id', internetMessageId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data
  } catch (error) {
    console.error(`Error checking existing tracked email:`, error)
    return null
  }
}

/**
 * Insère un nouvel email suivi
 */
async function insertTrackedEmail(supabase: EdgeSupabaseClient, message: EmailMessage, mailboxId: string): Promise<void> {
  try {
    const recipientEmails = message.toRecipients.map(r => r.emailAddress.address)
    const ccEmails = message.ccRecipients?.map(r => r.emailAddress.address) || []

    const { error } = await supabase
      .from('tracked_emails')
      .insert({
        microsoft_message_id: message.id,
        conversation_id: message.conversationId,
        conversation_index: message.conversationIndex,
        internet_message_id: message.internetMessageId,
        in_reply_to: message.inReplyTo,
        references: message.references,
        mailbox_id: mailboxId,
        subject: message.subject,
        sender_email: message.sender.emailAddress.address,
        recipient_emails: recipientEmails,
        cc_emails: ccEmails.length > 0 ? ccEmails : null,
        body_preview: message.bodyPreview,
        has_attachments: message.hasAttachments,
        importance: message.importance,
        status: 'pending',
        sent_at: message.sentDateTime,
        is_reply: false, // TODO: Détecter si c'est une réponse
        thread_position: 1 // TODO: Calculer la position dans le thread
      })

    if (error) {
      throw error
    }

    // Stocker les headers importants si disponibles
    if (message.internetMessageHeaders && message.internetMessageHeaders.length > 0) {
      await storeMessageHeaders(supabase, message.id, message.internetMessageHeaders)
    }

  } catch (error) {
    console.error('Error inserting tracked email:', error)
    throw error
  }
}

/**
 * Stocke les headers d'email importants
 */
async function storeMessageHeaders(
  supabase: EdgeSupabaseClient,
  messageId: string,
  headers: Array<{name: string, value: string}>
): Promise<void> {
  try {
    // Headers importants pour la détection
    const importantHeaders = [
      'Message-ID',
      'In-Reply-To',
      'References',
      'Thread-Topic',
      'Thread-Index',
      'Auto-Submitted',
      'X-Auto-Response-Suppress'
    ]

    const headersToStore = headers.filter(h =>
      importantHeaders.includes(h.name)
    )

    if (headersToStore.length === 0) {
      return
    }

    const { error } = await supabase
      .from('message_headers')
      .insert(
        headersToStore.map(header => ({
          tracked_email_id: messageId, // Note: On utilise l'ID du message, pas l'UUID
          header_name: header.name,
          header_value: header.value
        }))
      )

    if (error) {
      console.warn('Failed to store message headers:', error)
    }
  } catch (error) {
    console.warn('Error storing message headers:', error)
  }
}

/**
 * Log une tentative de détection pour monitoring
 */
async function logDetectionAttempt(
  supabase: EdgeSupabaseClient,
  message: EmailMessage,
  isResponse: boolean,
  trackedEmailId: string | null,
  detectionMethod: string,
  rejectionReason: string | null
): Promise<void> {
  try {
    await supabase
      .from('detection_logs')
      .insert({
        microsoft_message_id: message.id,
        conversation_id: message.conversationId,
        is_response: isResponse,
        tracked_email_id: trackedEmailId,
        detection_method: detectionMethod,
        rejection_reason: rejectionReason,
        detection_time_ms: 0 // TODO: Mesurer le temps de détection
      })
  } catch (error) {
    console.warn('Failed to log detection attempt:', error)
  }
}