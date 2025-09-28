/**
 * Edge Function - Mailbox Email Processor
 *
 * Fonction utilitaire qui récupère les emails des mailboxes actives sur une période donnée
 * et remplit la table tracked_emails en déterminant s'ils ont reçu une réponse ou non
 *
 * Paramètres:
 * - startDate: Date de début (ISO string)
 * - endDate: Date de fin (ISO string)
 * - mailboxIds?: Array d'IDs de mailboxes spécifiques (optionnel)
 * - processResponses: boolean pour traiter également les réponses (défaut: true)
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  EdgeSupabaseClient,
  MailboxRow,
  TrackedEmailInsert
} from '../_shared/types.ts'
import {
  processEmailWithEnhancedDetection,
  GraphEmail
} from './enhanced-processor.ts'

console.log('Mailbox Email Processor - Ready!')

/**
 * Interface pour les paramètres de la fonction
 */
interface ProcessorRequest {
  startDate: string
  endDate: string
  mailboxIds?: string[]
  processResponses?: boolean
  dryRun?: boolean
  requireSpecificMailboxes?: boolean
}

/**
 * Interface pour les statistiques du traitement
 */
interface ProcessingStats {
  mailboxesProcessed: number
  totalEmailsFound: number
  outgoingEmails: number
  incomingEmails: number
  trackedEmailsInserted: number
  responsesDetected: number
  skippedEmails: number
  errors: string[]
  processedMailboxes: {
    mailboxId: string
    emailAddress: string
    emailsFound: number
    trackedInserted: number
    responsesFound: number
    skippedEmails: number
  }[]
}

// GraphEmail interface moved to enhanced-processor.ts

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

  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
        message: 'Use POST with startDate and endDate parameters'
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Parser les paramètres de la requête
    const body: ProcessorRequest = await req.json()

    // Validation des paramètres requis
    if (!body.startDate || !body.endDate) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameters',
          message: 'startDate and endDate are required (ISO string format)'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validation des dates
    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return new Response(
        JSON.stringify({
          error: 'Invalid date format',
          message: 'Dates must be valid ISO strings'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (startDate >= endDate) {
      return new Response(
        JSON.stringify({
          error: 'Invalid date range',
          message: 'startDate must be before endDate'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validation de l'exigence de mailboxes spécifiques
    if (body.requireSpecificMailboxes && (!body.mailboxIds || body.mailboxIds.length === 0)) {
      return new Response(
        JSON.stringify({
          error: 'Mailboxes required',
          message: 'When requireSpecificMailboxes is true, mailboxIds must be provided and cannot be empty'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Processing emails from ${body.startDate} to ${body.endDate}`)
    if (body.mailboxIds?.length) {
      console.log(`Specific mailboxes (${body.mailboxIds.length}): ${body.mailboxIds.join(', ')}`)
    } else {
      console.log(`Mode: Processing ALL active mailboxes`)
    }
    if (body.requireSpecificMailboxes) {
      console.log('Specific mailboxes mode REQUIRED - will not process all mailboxes')
    }
    if (body.dryRun) {
      console.log('DRY RUN MODE - No data will be inserted')
    }

    // Traiter les emails
    const stats = await processMailboxEmails(supabase, body)

    // Retourner les résultats
    return new Response(
      JSON.stringify({
        success: true,
        stats,
        parameters: {
          startDate: body.startDate,
          endDate: body.endDate,
          mailboxIds: body.mailboxIds,
          processResponses: body.processResponses ?? true,
          dryRun: body.dryRun ?? false,
          requireSpecificMailboxes: body.requireSpecificMailboxes ?? false
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error processing mailbox emails:', error)

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
 * Traite les emails de toutes les mailboxes actives
 */
async function processMailboxEmails(
  supabase: EdgeSupabaseClient,
  request: ProcessorRequest
): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    mailboxesProcessed: 0,
    totalEmailsFound: 0,
    outgoingEmails: 0,
    incomingEmails: 0,
    trackedEmailsInserted: 0,
    responsesDetected: 0,
    skippedEmails: 0,
    errors: [],
    processedMailboxes: []
  }

  try {
    // Récupérer les mailboxes actives
    const mailboxes = await getActiveMailboxes(supabase, request.mailboxIds)
    console.log(`Found ${mailboxes.length} active mailboxes to process`)

    if (mailboxes.length === 0) {
      stats.errors.push('No active mailboxes found')
      return stats
    }

    // Obtenir un token d'accès Microsoft Graph
    const accessToken = await getAccessToken()
    if (!accessToken) {
      stats.errors.push('Failed to obtain Microsoft Graph access token')
      return stats
    }

    // Traiter chaque mailbox
    for (const mailbox of mailboxes) {
      try {
        console.log(`Processing mailbox: ${mailbox.email_address}`)

        const mailboxStats = await processMailboxEmails_Single(
          supabase,
          mailbox,
          request,
          accessToken
        )

        stats.mailboxesProcessed++
        stats.totalEmailsFound += mailboxStats.emailsFound
        stats.outgoingEmails += mailboxStats.outgoingCount
        stats.incomingEmails += mailboxStats.incomingCount
        stats.trackedEmailsInserted += mailboxStats.trackedInserted
        stats.responsesDetected += mailboxStats.responsesFound
        stats.skippedEmails += mailboxStats.skippedEmails

        stats.processedMailboxes.push({
          mailboxId: mailbox.id,
          emailAddress: mailbox.email_address,
          emailsFound: mailboxStats.emailsFound,
          trackedInserted: mailboxStats.trackedInserted,
          responsesFound: mailboxStats.responsesFound,
          skippedEmails: mailboxStats.skippedEmails
        })

        console.log(`Completed mailbox ${mailbox.email_address}: ${mailboxStats.emailsFound} emails, ${mailboxStats.trackedInserted} tracked`)

      } catch (error) {
        const errorMsg = `Error processing mailbox ${mailbox.email_address}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        stats.errors.push(errorMsg)
      }
    }

    console.log(`Processing complete. Total: ${stats.totalEmailsFound} emails found, ${stats.trackedEmailsInserted} tracked`)
    return stats

  } catch (error) {
    const errorMsg = `Fatal error during processing: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(errorMsg)
    stats.errors.push(errorMsg)
    return stats
  }
}

/**
 * Traite les emails d'une mailbox spécifique
 */
async function processMailboxEmails_Single(
  supabase: EdgeSupabaseClient,
  mailbox: MailboxRow,
  request: ProcessorRequest,
  accessToken: string
) {
  const result = {
    emailsFound: 0,
    outgoingCount: 0,
    incomingCount: 0,
    trackedInserted: 0,
    responsesFound: 0,
    skippedEmails: 0
  }

  try {
    // Récupérer les emails de la période via Microsoft Graph
    const emails = await fetchMailboxEmails(
      mailbox.microsoft_user_id,
      request.startDate,
      request.endDate,
      accessToken
    )

    result.emailsFound = emails.length
    console.log(`Found ${emails.length} emails in mailbox ${mailbox.email_address}`)

    if (emails.length === 0) {
      return result
    }

    // Récupérer la configuration tenant pour l'exclusion
    const tenantConfig = await getTenantConfig(supabase)

    console.log(`📧 Processing ${emails.length} emails with ENHANCED detection for mailbox: ${mailbox.email_address}`)

    // Traiter chaque email avec la logique améliorée
    for (const email of emails) {
      try {
        if (!request.dryRun) {
          // Utiliser la logique améliorée de détection
          const processingResult = await processEmailWithEnhancedDetection(
            supabase,
            email,
            mailbox.id,
            tenantConfig
          )

          if (processingResult.processed) {
            if (processingResult.action === 'tracked') {
              result.outgoingCount++
              result.trackedInserted++
              console.log(`✅ Enhanced: Tracked - ${email.subject}`)
            } else if (processingResult.action === 'response_detected') {
              result.incomingCount++
              result.responsesFound++
              console.log(`✅ Enhanced: Response - ${email.subject}`)
            }
          } else {
            result.skippedEmails++
            console.log(`⏭️ Enhanced: Skipped (${processingResult.reason}) - ${email.subject}`)
          }
        } else {
          // Mode dry run - classification simple pour statistiques
          if (shouldExcludeEmail(email, tenantConfig)) {
            result.skippedEmails++
            continue
          }

          const emailType = classifyEmailType(email, mailbox)

          if (emailType === 'outgoing') {
            result.outgoingCount++
            const exists = await emailExistsInDatabase(supabase, email.internetMessageId)
            if (!exists) {
              result.trackedInserted++
            } else {
              result.skippedEmails++
            }
          } else if (emailType === 'incoming' && (request.processResponses ?? true)) {
            result.incomingCount++
            if (detectIsReply(email)) {
              result.responsesFound++
            } else {
              result.skippedEmails++
            }
          } else {
            result.skippedEmails++
          }
        }

      } catch (error) {
        console.error(`Error processing individual email ${email.id}:`, error)
        result.skippedEmails++
        // Continuer avec les autres emails
      }
    }

    return result

  } catch (error) {
    console.error(`Error processing mailbox ${mailbox.email_address}:`, error)
    throw error
  }
}

/**
 * Récupère les mailboxes actives
 */
async function getActiveMailboxes(
  supabase: EdgeSupabaseClient,
  mailboxIds?: string[]
): Promise<MailboxRow[]> {
  try {
    let query = supabase
      .from('mailboxes')
      .select('*')
      .eq('is_active', true)

    if (mailboxIds?.length) {
      query = query.in('id', mailboxIds)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Error getting active mailboxes:', error)
    throw error
  }
}

/**
 * Obtient un token d'accès Microsoft Graph
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
 * Récupère les emails d'une mailbox via Microsoft Graph
 */
async function fetchMailboxEmails(
  microsoftUserId: string,
  startDate: string,
  endDate: string,
  accessToken: string
): Promise<GraphEmail[]> {
  const emails: GraphEmail[] = []
  let nextLink: string | null = null

  try {
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

      console.log(`Fetching emails from: ${url}`)

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
        console.log(`Fetched ${validEmails.length} valid emails (${data.value.length} total, ${data.value.length - validEmails.length} drafts excluded)`)
      }

      // Vérifier s'il y a une page suivante
      nextLink = data['@odata.nextLink'] || null

    } while (nextLink)

    console.log(`Total emails fetched for user ${microsoftUserId}: ${emails.length}`)
    return emails

  } catch (error) {
    console.error(`Error fetching emails for user ${microsoftUserId}:`, error)
    throw error
  }
}

/**
 * Récupère la configuration tenant
 */
async function getTenantConfig(supabase: EdgeSupabaseClient): Promise<TenantConfig | null> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'tenant_config')
      .single()

    if (error || !data?.value) {
      return null
    }

    const config: TenantConfig = typeof data.value === 'string'
      ? JSON.parse(data.value)
      : data.value

    return config
  } catch (error) {
    console.warn('Error getting tenant config:', error)
    return null
  }
}

/**
 * Vérifie si un email doit être exclu (email interne)
 */
function shouldExcludeEmail(email: GraphEmail, tenantConfig: TenantConfig | null): boolean {
  if (!tenantConfig?.exclude_internal_emails || !tenantConfig.domain) {
    return false
  }

  const senderDomain = email.sender.emailAddress.address.split('@')[1]
  const tenantDomain = tenantConfig.domain.replace('@', '')

  return senderDomain === tenantDomain
}

/**
 * Classifie un email comme sortant, entrant ou inconnu
 */
function classifyEmailType(
  email: GraphEmail,
  mailbox: MailboxRow
): 'outgoing' | 'incoming' | 'unknown' {
  try {
    const senderEmail = email.sender.emailAddress.address.toLowerCase()
    const mailboxEmail = mailbox.email_address.toLowerCase()

    // Email sortant: expéditeur est la mailbox
    if (senderEmail === mailboxEmail) {
      return 'outgoing'
    }

    // Email entrant: expéditeur différent de la mailbox
    return 'incoming'

  } catch (error) {
    console.error('Error classifying email type:', error)
    return 'unknown'
  }
}

/**
 * Vérifie si un email existe déjà en base de données
 */
async function emailExistsInDatabase(
  supabase: EdgeSupabaseClient,
  internetMessageId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('tracked_emails')
      .select('id')
      .eq('internet_message_id', internetMessageId)
      .single()

    return !error && !!data
  } catch (error) {
    console.error('Error checking if email exists:', error)
    return false
  }
}

/**
 * Insère un email comme tracké en base de données
 */
async function _insertTrackedEmail(
  supabase: EdgeSupabaseClient,
  email: GraphEmail,
  mailboxId: string
): Promise<void> {
  try {
    const recipientEmails = email.toRecipients.map(r => r.emailAddress.address)
    const ccEmails = email.ccRecipients?.map(r => r.emailAddress.address) || []

    const trackedEmail: TrackedEmailInsert = {
      microsoft_message_id: email.id,
      conversation_id: email.conversationId,
      conversation_index: email.conversationIndex,
      internet_message_id: email.internetMessageId,
      in_reply_to: email.inReplyTo,
      references: email.references,
      mailbox_id: mailboxId,
      subject: email.subject,
      sender_email: email.sender.emailAddress.address,
      recipient_emails: recipientEmails,
      cc_emails: ccEmails.length > 0 ? ccEmails : undefined,
      body_preview: email.bodyPreview,
      has_attachments: email.hasAttachments,
      importance: email.importance,
      status: 'pending',
      sent_at: email.sentDateTime,
      is_reply: detectIsReply(email),
      thread_position: calculateThreadPosition(email.conversationIndex)
    }

    const { error } = await supabase
      .from('tracked_emails')
      .insert(trackedEmail)

    if (error) {
      throw error
    }

    console.log(`Inserted tracked email: ${email.subject}`)
  } catch (error) {
    console.error('Error inserting tracked email:', error)
    throw error
  }
}

/**
 * Gère une réponse email en trouvant l'original et en mettant à jour le statut
 */
async function _handleEmailResponse(
  supabase: EdgeSupabaseClient,
  responseEmail: GraphEmail
): Promise<boolean> {
  try {
    // Trouver l'email original tracké
    const originalEmail = await findOriginalTrackedEmail(supabase, responseEmail)

    if (!originalEmail) {
      console.log(`No original tracked email found for response: ${responseEmail.subject}`)
      return false
    }

    // Insérer la réponse (le trigger se chargera de mettre à jour le statut)
    const { error } = await supabase
      .from('email_responses')
      .insert({
        tracked_email_id: originalEmail.id,
        microsoft_message_id: responseEmail.id,
        sender_email: responseEmail.sender.emailAddress.address,
        subject: responseEmail.subject,
        body_preview: responseEmail.bodyPreview,
        received_at: responseEmail.sentDateTime,
        response_type: determineResponseType(responseEmail),
        is_auto_response: isAutoResponse(responseEmail)
      })

    if (error) {
      console.error('Error inserting email response:', error)
      return false
    }

    console.log(`Processed response: ${responseEmail.subject} -> Original: ${originalEmail.subject}`)
    return true

  } catch (error) {
    console.error('Error handling email response:', error)
    return false
  }
}

/**
 * Trouve l'email original tracké correspondant à une réponse
 */
async function findOriginalTrackedEmail(
  supabase: EdgeSupabaseClient,
  responseEmail: GraphEmail
): Promise<{ id: string; subject: string; [key: string]: unknown } | null> {
  try {
    // Méthode 1: Par conversationId + inReplyTo
    if (responseEmail.conversationId && responseEmail.inReplyTo) {
      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('conversation_id', responseEmail.conversationId)
        .eq('internet_message_id', responseEmail.inReplyTo)
        .eq('status', 'pending')
        .single()

      if (!error && data) {
        return data
      }
    }

    // Méthode 2: Par conversationId + references
    if (responseEmail.conversationId && responseEmail.references) {
      const references = responseEmail.references.split(' ').filter(ref => ref.trim())

      for (const ref of references) {
        const { data, error } = await supabase
          .from('tracked_emails')
          .select('*')
          .eq('conversation_id', responseEmail.conversationId)
          .eq('internet_message_id', ref.trim())
          .eq('status', 'pending')
          .single()

        if (!error && data) {
          return data
        }
      }
    }

    // Méthode 3: Fallback par conversationId seul
    if (responseEmail.conversationId) {
      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('conversation_id', responseEmail.conversationId)
        .eq('status', 'pending')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) {
        return data
      }
    }

    return null
  } catch (error) {
    console.error('Error finding original tracked email:', error)
    return null
  }
}

/**
 * Détermine le type de réponse
 */
function determineResponseType(email: GraphEmail): 'direct_reply' | 'forward' | 'auto_reply' | 'bounce' {
  // Vérifier les auto-replies
  if (isAutoResponse(email)) {
    return 'auto_reply'
  }

  // Vérifier le sujet pour forward
  if (email.subject) {
    const subject = email.subject.toLowerCase()
    const forwardPrefixes = ['fw:', 'fwd:', 'tr:', 'enc:', 'weiterleitung:']

    for (const prefix of forwardPrefixes) {
      if (subject.startsWith(prefix)) {
        return 'forward'
      }
    }
  }

  return 'direct_reply'
}

/**
 * Vérifie si un email est une réponse automatique
 */
function isAutoResponse(email: GraphEmail): boolean {
  if (!email.internetMessageHeaders || email.internetMessageHeaders.length === 0) {
    return false
  }

  for (const header of email.internetMessageHeaders) {
    const headerName = header.name.toLowerCase()
    const headerValue = header.value?.toLowerCase() || ''

    if (headerName === 'auto-submitted' && headerValue.includes('auto-replied')) {
      return true
    }
    if (headerName === 'x-autoreply' || headerName === 'x-autorespond') {
      return true
    }
    if (headerName === 'x-mailer' && headerValue.includes('auto')) {
      return true
    }
  }

  return false
}

/**
 * Détecte si un email est une réponse
 */
function detectIsReply(email: GraphEmail): boolean {
  // 1. Vérifier les headers
  if (email.internetMessageHeaders && email.internetMessageHeaders.length > 0) {
    const replyHeaders = ['In-Reply-To', 'References']
    for (const header of email.internetMessageHeaders) {
      if (replyHeaders.includes(header.name) && header.value) {
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

  const subject = email.subject.trim()
  for (const prefix of replyPrefixes) {
    if (subject.startsWith(prefix)) {
      return true
    }
  }

  // 3. Vérifier la profondeur du conversationIndex
  if (email.conversationIndex) {
    return email.conversationIndex.length > 44
  }

  return false
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

/**
 * Calcule la position d'un message dans un thread
 */
function calculateThreadPosition(conversationIndex?: string): number {
  if (!conversationIndex) {
    return 1
  }

  try {
    const baseLength = 44
    const replyLength = 10

    if (conversationIndex.length <= baseLength) {
      return 1
    }

    const additionalLength = conversationIndex.length - baseLength
    return Math.floor(additionalLength / replyLength) + 1
  } catch (error) {
    console.warn('Error calculating thread position:', error)
    return 1
  }
}