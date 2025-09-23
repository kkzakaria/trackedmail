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

interface NotificationWithEncryption extends MicrosoftGraphWebhookNotification {
  encryptedContent?: string
  dataSignature?: string
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
    const isValid = await validateWebhookSecurity(req, payload)
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
async function validateWebhookSecurity(
  req: Request,
  payload: WebhookPayload
): Promise<boolean> {
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

    // Validation de signature selon les recommandations OWASP et Microsoft Graph
    return await validateWebhookSignature(req, payload, webhookSecret)
  } catch (error) {
    console.error('Error validating webhook security:', error)
    return false
  }
}

/**
 * Valide la signature du webhook selon les recommandations OWASP et Microsoft Graph
 * Implémente la validation JWT et HMAC-SHA256 pour la sécurité
 */
async function validateWebhookSignature(
  req: Request,
  payload: WebhookPayload,
  webhookSecret: string
): Promise<boolean> {
  try {
    console.log('[SECURITY] Starting webhook signature validation')

    // 1. Validation des JWT tokens (recommandation Microsoft Graph)
    if (payload.validationTokens && payload.validationTokens.length > 0) {
      console.log('[SECURITY] Validating JWT tokens from payload')

      for (const token of payload.validationTokens) {
        const isValidJWT = validateJWTToken(token)
        if (!isValidJWT) {
          console.warn('[SECURITY] JWT token validation failed')
          logSecurityEvent('jwt_validation_failed', req, { token: token.substring(0, 20) + '...' })
          return false
        }
      }
    }

    // 2. Validation HMAC-SHA256 pour les données chiffrées (recommandation OWASP)
    if (payload.value && payload.value.length > 0) {
      for (const notification of payload.value) {
        // Vérifier si la notification contient des données chiffrées avec signature
        const notificationWithEncryption = notification as NotificationWithEncryption
        if (notificationWithEncryption.encryptedContent && notificationWithEncryption.dataSignature) {
          const isValidHMAC = await validateHMACSignature(
            notificationWithEncryption.encryptedContent,
            notificationWithEncryption.dataSignature,
            webhookSecret
          )
          if (!isValidHMAC) {
            console.warn('[SECURITY] HMAC signature validation failed')
            logSecurityEvent('hmac_validation_failed', req, { notificationId: notification.resourceData.id })
            return false
          }
        }
      }
    }

    // 3. Protection contre les attaques de replay (timestamp validation)
    const timestamp = req.headers.get('timestamp') || req.headers.get('x-timestamp')
    if (timestamp) {
      const isValidTimestamp = validateTimestamp(timestamp)
      if (!isValidTimestamp) {
        console.warn('[SECURITY] Timestamp validation failed - possible replay attack')
        logSecurityEvent('replay_attack_detected', req, { timestamp })
        return false
      }
    }

    console.log('[SECURITY] Webhook signature validation successful')
    logSecurityEvent('signature_validation_success', req, {})
    return true

  } catch (error) {
    console.error('[SECURITY] Error during signature validation:', error)
    logSecurityEvent('signature_validation_error', req, { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

/**
 * Valide un JWT token selon les spécifications Microsoft Graph
 */
function validateJWTToken(token: string): boolean {
  try {
    // Validation basique de la structure JWT
    const parts = token.split('.')
    if (parts.length !== 3) {
      return false
    }

    // Décoder le payload
    const payload = JSON.parse(atob(parts[1]))

    // Vérifier l'expiration
    const exp = payload.exp
    if (!exp || exp <= Math.floor(Date.now() / 1000)) {
      console.warn('[SECURITY] JWT token expired')
      return false
    }

    // Vérifier l'émetteur Microsoft Graph (recommandation Microsoft)
    const azp = payload.azp
    if (azp !== '0bf30f3b-4a52-48df-9a82-234910c4a086') {
      console.warn('[SECURITY] JWT token from invalid issuer:', azp)
      return false
    }

    // Vérifier l'audience (notre webhook URL)
    const webhookBaseUrl = Deno.env.get('MICROSOFT_WEBHOOK_BASE_URL')
    if (webhookBaseUrl && payload.aud && !payload.aud.includes(webhookBaseUrl)) {
      console.warn('[SECURITY] JWT token invalid audience')
      return false
    }

    return true
  } catch (error) {
    console.warn('[SECURITY] JWT token validation error:', error)
    return false
  }
}

/**
 * Valide la signature HMAC-SHA256 selon les recommandations OWASP
 */
async function validateHMACSignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(data)

    // Importer la clé pour HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )

    // Calculer la signature HMAC-SHA256
    const calculatedSignature = await crypto.subtle.sign('HMAC', key, messageData)
    const calculatedSignatureBase64 = btoa(String.fromCharCode(...new Uint8Array(calculatedSignature)))

    // Comparaison sécurisée pour éviter les attaques de timing
    return timingSafeEqual(calculatedSignatureBase64, signature)
  } catch (error) {
    console.warn('[SECURITY] HMAC validation error:', error)
    return false
  }
}

/**
 * Validation de timestamp pour protection contre les attaques de replay
 */
function validateTimestamp(timestamp: string): boolean {
  try {
    const requestTime = parseInt(timestamp) * 1000 // Convertir en millisecondes
    const currentTime = Date.now()
    const timeDiff = Math.abs(currentTime - requestTime)

    // Fenêtre de tolérance de 5 minutes (recommandation OWASP)
    const tolerance = 5 * 60 * 1000 // 5 minutes en millisecondes

    return timeDiff <= tolerance
  } catch (error) {
    console.warn('[SECURITY] Timestamp validation error:', error)
    return false
  }
}

/**
 * Comparaison sécurisée pour éviter les attaques de timing (recommandation OWASP)
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Log des événements de sécurité pour traçabilité et monitoring
 */
function logSecurityEvent(
  eventType: string,
  req: Request,
  details: Record<string, unknown>
): void {
  const securityLog = {
    timestamp: new Date().toISOString(),
    event_type: eventType,
    ip_address: req.headers.get('X-Forwarded-For') || req.headers.get('CF-Connecting-IP') || 'unknown',
    user_agent: req.headers.get('User-Agent') || 'unknown',
    url: req.url,
    details
  }

  console.log('[SECURITY_LOG]', JSON.stringify(securityLog))

  // En production, envoyer vers un système de monitoring de sécurité
  // comme Supabase Edge Functions logs ou un SIEM
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
  const startTime = Date.now()
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
      await logDetectionAttempt(supabase, messageDetails, false, null, 'not_detected', 'internal_email', Date.now() - startTime)
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

    // Vérifier si c'est une réponse à un email tracké
    if (detectIsReply(messageDetails)) {
      console.log(`Detected reply email: ${messageDetails.subject}`)
      await handleEmailResponse(supabase, messageDetails, startTime)
      return
    }

    // Sinon, traiter comme un nouvel email à tracker
    await insertTrackedEmail(supabase, messageDetails, mailbox.id)

    // Log de la détection réussie
    await logDetectionAttempt(supabase, messageDetails, true, null, 'conversation_id', null, Date.now() - startTime)

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
        is_reply: detectIsReply(message),
        thread_position: calculateThreadPosition(message.conversationIndex)
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
  rejectionReason: string | null,
  detectionTimeMs: number
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
        detection_time_ms: detectionTimeMs
      })
  } catch (error) {
    console.warn('Failed to log detection attempt:', error)
  }
}

/**
 * Détermine le type de réponse d'un email
 */
function determineResponseType(message: EmailMessage): 'direct_reply' | 'forward' | 'auto_reply' | 'bounce' {
  // Vérifier les auto-replies en premier
  if (message.internetMessageHeaders && message.internetMessageHeaders.length > 0) {
    for (const header of message.internetMessageHeaders) {
      const headerName = header.name.toLowerCase()
      const headerValue = header.value?.toLowerCase() || ''

      // Headers d'auto-reply
      if (headerName === 'auto-submitted' && headerValue.includes('auto-replied')) {
        return 'auto_reply'
      }
      if (headerName === 'x-autoreply' || headerName === 'x-autorespond') {
        return 'auto_reply'
      }
      if (headerName === 'x-mailer' && headerValue.includes('auto')) {
        return 'auto_reply'
      }

      // Headers de bounce
      if (headerName === 'x-failed-recipients' || headerName === 'x-delivery-status') {
        return 'bounce'
      }
    }
  }

  // Vérifier le sujet pour forward
  if (message.subject) {
    const subject = message.subject.toLowerCase()
    const forwardPrefixes = ['fw:', 'fwd:', 'tr:', 'enc:', 'weiterleitung:']

    for (const prefix of forwardPrefixes) {
      if (subject.startsWith(prefix)) {
        return 'forward'
      }
    }
  }

  // Par défaut, c'est une réponse directe
  return 'direct_reply'
}

/**
 * Trouve l'email original tracké correspondant à une réponse
 */
async function findOriginalTrackedEmail(
  supabase: EdgeSupabaseClient,
  responseMessage: EmailMessage
): Promise<{ id: string; subject: string; [key: string]: unknown } | null> {
  try {
    console.log(`Searching for original tracked email for response: ${responseMessage.id}`)

    // Méthode 1: Recherche par conversationId + inReplyTo (le plus fiable)
    if (responseMessage.conversationId && responseMessage.inReplyTo) {
      console.log(`Searching by conversationId + inReplyTo: ${responseMessage.conversationId} / ${responseMessage.inReplyTo}`)

      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('conversation_id', responseMessage.conversationId)
        .eq('internet_message_id', responseMessage.inReplyTo)
        .eq('status', 'pending')
        .single()

      if (!error && data) {
        console.log(`Found original email by inReplyTo: ${data.id}`)
        return data
      }
    }

    // Méthode 2: Recherche par conversationId + references
    if (responseMessage.conversationId && responseMessage.references) {
      console.log(`Searching by conversationId + references: ${responseMessage.conversationId}`)

      const references = responseMessage.references.split(' ').filter(ref => ref.trim())

      for (const ref of references) {
        const { data, error } = await supabase
          .from('tracked_emails')
          .select('*')
          .eq('conversation_id', responseMessage.conversationId)
          .eq('internet_message_id', ref.trim())
          .eq('status', 'pending')
          .single()

        if (!error && data) {
          console.log(`Found original email by reference: ${data.id}`)
          return data
        }
      }
    }

    // Méthode 3: Fallback par conversationId seul (dernière tentative)
    if (responseMessage.conversationId) {
      console.log(`Fallback search by conversationId only: ${responseMessage.conversationId}`)

      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('conversation_id', responseMessage.conversationId)
        .eq('status', 'pending')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) {
        console.log(`Found original email by conversationId fallback: ${data.id}`)
        return data
      }
    }

    console.log('No original tracked email found')
    return null

  } catch (error) {
    console.error('Error finding original tracked email:', error)
    return null
  }
}

/**
 * Gère les emails de réponse (ne les tracke pas, mais marque l'original comme responded)
 */
async function handleEmailResponse(
  supabase: EdgeSupabaseClient,
  responseMessage: EmailMessage,
  startTime: number
): Promise<void> {
  try {
    console.log(`Handling email response: ${responseMessage.subject}`)

    // Trouver l'email original
    const originalEmail = await findOriginalTrackedEmail(supabase, responseMessage)

    if (!originalEmail) {
      console.log('No original tracked email found for this response, logging as orphaned response')
      await logDetectionAttempt(
        supabase,
        responseMessage,
        false,
        null,
        'response_orphaned',
        'original_not_found',
        Date.now() - startTime
      )
      return
    }

    // Déterminer le type de réponse
    const responseType = determineResponseType(responseMessage)

    // Insérer dans email_responses (le trigger se chargera de mettre à jour le statut)
    const { error } = await supabase
      .from('email_responses')
      .insert({
        tracked_email_id: originalEmail.id,
        microsoft_message_id: responseMessage.id,
        sender_email: responseMessage.sender.emailAddress.address,
        subject: responseMessage.subject,
        body_preview: responseMessage.bodyPreview,
        received_at: responseMessage.sentDateTime,
        response_type: responseType,
        is_auto_response: responseType === 'auto_reply'
      })

    if (error) {
      console.error('Error inserting email response:', error)
      throw error
    }

    // Logger la détection réussie
    await logDetectionAttempt(
      supabase,
      responseMessage,
      true,
      originalEmail.id,
      'response_detected',
      null,
      Date.now() - startTime
    )

    console.log(`Successfully processed response: ${responseMessage.subject} -> Original: ${originalEmail.subject}`)

  } catch (error) {
    console.error('Error handling email response:', error)

    // Logger l'erreur
    await logDetectionAttempt(
      supabase,
      responseMessage,
      false,
      null,
      'response_error',
      error instanceof Error ? error.message : 'unknown_error',
      Date.now() - startTime
    )

    throw error
  }
}

/**
 * Détecte si un email est une réponse à un autre email
 * Basé sur les headers et le sujet
 */
function detectIsReply(message: EmailMessage): boolean {
  // 1. Vérifier les headers de threading
  if (message.internetMessageHeaders && message.internetMessageHeaders.length > 0) {
    const replyHeaders = ['In-Reply-To', 'References']
    for (const header of message.internetMessageHeaders) {
      if (replyHeaders.includes(header.name) && header.value) {
        console.log(`Email detected as reply based on header: ${header.name}`)
        return true
      }
    }
  }

  // 2. Vérifier le sujet pour les préfixes de réponse
  const replyPrefixes = [
    'RE:', 'Re:', 're:', 'Réf:', 'REF:',
    'FW:', 'Fw:', 'fw:', 'TR:', 'Tr:',
    'RES:', 'Res:', 'res:'
  ]

  const subject = message.subject.trim()
  for (const prefix of replyPrefixes) {
    if (subject.startsWith(prefix)) {
      console.log(`Email detected as reply based on subject prefix: ${prefix}`)
      return true
    }
  }

  // 3. Vérifier la profondeur du conversationIndex
  // Un conversationIndex plus long que la base indique une réponse
  if (message.conversationIndex) {
    // Base = 22 bytes (44 caractères hex), chaque réponse ajoute 5 bytes (10 caractères)
    const isReply = message.conversationIndex.length > 44
    if (isReply) {
      console.log(`Email detected as reply based on conversationIndex length: ${message.conversationIndex.length}`)
      return true
    }
  }

  return false
}

/**
 * Calcule la position d'un message dans un thread de conversation
 * Basé sur le conversationIndex Microsoft
 */
function calculateThreadPosition(conversationIndex?: string): number {
  if (!conversationIndex) {
    return 1
  }

  try {
    // Le conversationIndex Microsoft utilise un format spécifique :
    // - 22 bytes (44 caractères hex) pour le message initial
    // - 5 bytes supplémentaires (10 caractères) pour chaque réponse
    const baseLength = 44
    const replyLength = 10

    if (conversationIndex.length <= baseLength) {
      return 1 // Message initial
    }

    // Calculer le nombre de réponses
    const additionalLength = conversationIndex.length - baseLength
    const position = Math.floor(additionalLength / replyLength) + 1

    console.log(`Thread position calculated: ${position} (index length: ${conversationIndex.length})`)
    return position

  } catch (error) {
    console.warn('Error calculating thread position:', error)
    return 1
  }
}