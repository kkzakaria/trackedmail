/**
 * Module principal de traitement des emails
 * Responsable de l'orchestration du traitement des emails pour toutes les mailboxes
 */

import {
  EdgeSupabaseClient,
  ProcessorRequest,
  ProcessingStats,
  MailboxProcessingResult,
  MailboxRow
} from './shared-types.ts'
import { getActiveMailboxes, getAccessToken, getTenantConfig } from './mailbox-manager.ts'
import { fetchMailboxEmails } from './email-fetcher.ts'
import { processEmailWithEnhancedDetection } from './enhanced-processor.ts'
import {
  shouldExcludeEmail,
  classifyEmailType,
  emailExistsInDatabase,
  detectIsReply
} from './email-analyzer.ts'

/**
 * Traite les emails de toutes les mailboxes actives
 */
export async function processMailboxEmails(
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
    console.log(`🚀 Starting email processing from ${request.startDate} to ${request.endDate}`)

    // Récupérer les mailboxes actives
    const mailboxes = await getActiveMailboxes(supabase, request.mailboxIds)
    console.log(`📋 Found ${mailboxes.length} active mailboxes to process`)

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
        console.log(`📬 Processing mailbox: ${mailbox.email_address}`)

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

        console.log(`✅ Completed mailbox ${mailbox.email_address}: ${mailboxStats.emailsFound} emails, ${mailboxStats.trackedInserted} tracked`)

      } catch (error) {
        const errorMsg = `Error processing mailbox ${mailbox.email_address}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(`❌ ${errorMsg}`)
        stats.errors.push(errorMsg)
      }
    }

    console.log(`🎉 Processing complete. Total: ${stats.totalEmailsFound} emails found, ${stats.trackedEmailsInserted} tracked`)
    return stats

  } catch (error) {
    const errorMsg = `Fatal error during processing: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(`💥 ${errorMsg}`)
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
): Promise<MailboxProcessingResult> {
  const result: MailboxProcessingResult = {
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
    console.log(`📊 Found ${emails.length} emails in mailbox ${mailbox.email_address}`)

    if (emails.length === 0) {
      return result
    }

    // Récupérer la configuration tenant pour l'exclusion
    const tenantConfig = await getTenantConfig(supabase)

    console.log(`🔄 Processing ${emails.length} emails with ENHANCED detection for mailbox: ${mailbox.email_address}`)

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
        console.error(`❌ Error processing individual email ${email.id}:`, error)
        result.skippedEmails++
        // Continuer avec les autres emails
      }
    }

    return result

  } catch (error) {
    console.error(`❌ Error processing mailbox ${mailbox.email_address}:`, error)
    throw error
  }
}