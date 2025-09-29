/**
 * Bounce Processor Edge Function
 *
 * Periodically checks for unprocessed bounce emails and processes them.
 * Can be called via cron or webhook to handle NDR (Non-Delivery Reports).
 *
 * Responsibilities:
 * - Check for unprocessed bounces in the email_bounces table
 * - Attempt to match bounces with original tracked emails
 * - Update tracked email status
 * - Cancel scheduled followups
 * - Generate bounce statistics and alerts
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface UnprocessedBounce {
  id: string
  tracked_email_id: string | null
  bounce_type: 'hard' | 'soft' | 'unknown'
  bounce_code: string | null
  bounce_reason: string | null
  failed_recipients: string[]
  original_subject: string | null
  detected_at: string
}

interface BounceConfig {
  enabled: boolean
  hard_bounce_action: string
  soft_bounce_action: string
  soft_bounce_retry_limit: number
  soft_bounce_retry_delay_hours: number
  check_interval_minutes: number
  auto_disable_threshold_percent: number
  warning_threshold_percent: number
  monitoring_window_days: number
}

console.log('🚀 Bounce Processor Function Started')

Deno.serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    console.log('📨 Starting bounce processing...')

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get bounce detection configuration
    const config = await getBounceConfig(supabase)
    if (!config.enabled) {
      console.log('⚠️ Bounce detection is disabled')
      return new Response(JSON.stringify({
        success: true,
        message: 'Bounce detection is disabled',
        processed: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Process unprocessed bounces
    const processingResult = await processUnprocessedBounces(supabase, config)

    // Check bounce rates and send alerts if needed
    const alertResult = await checkBounceRatesAndAlert(supabase, config)

    // Prepare response
    const response = {
      success: true,
      message: 'Bounce processing completed',
      ...processingResult,
      alerts: alertResult
    }

    console.log(`✅ Bounce processing complete: ${processingResult.processed} bounces processed`)

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('❌ Bounce Processor Error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

/**
 * Get bounce detection configuration
 */
async function getBounceConfig(supabase: any): Promise<BounceConfig> {
  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'bounce_detection')
    .single()

  if (error || !data) {
    // Return default config
    return {
      enabled: true,
      hard_bounce_action: 'stop_immediately',
      soft_bounce_action: 'retry_limit',
      soft_bounce_retry_limit: 2,
      soft_bounce_retry_delay_hours: 24,
      check_interval_minutes: 5,
      auto_disable_threshold_percent: 10,
      warning_threshold_percent: 5,
      monitoring_window_days: 30
    }
  }

  return data.value as BounceConfig
}

/**
 * Process unprocessed bounce records
 */
async function processUnprocessedBounces(
  supabase: any,
  config: BounceConfig
): Promise<{
  processed: number,
  matched: number,
  hard_bounces: number,
  soft_bounces: number,
  followups_cancelled: number
}> {
  // Get unprocessed bounces
  const { data: bounces, error } = await supabase
    .from('email_bounces')
    .select('*')
    .eq('processed', false)
    .order('detected_at', { ascending: true })
    .limit(50) // Process in batches

  if (error) {
    throw new Error(`Failed to fetch unprocessed bounces: ${error.message}`)
  }

  if (!bounces || bounces.length === 0) {
    console.log('📭 No unprocessed bounces found')
    return {
      processed: 0,
      matched: 0,
      hard_bounces: 0,
      soft_bounces: 0,
      followups_cancelled: 0
    }
  }

  console.log(`📧 Found ${bounces.length} unprocessed bounces`)

  let matched = 0
  let hardBounces = 0
  let softBounces = 0
  let totalFollowupsCancelled = 0

  for (const bounce of bounces) {
    try {
      // If we don't have a tracked_email_id, try to find it
      let trackedEmailId = bounce.tracked_email_id
      if (!trackedEmailId) {
        trackedEmailId = await findTrackedEmailForBounce(supabase, bounce)
        if (trackedEmailId) {
          // Update bounce record with found email
          await supabase
            .from('email_bounces')
            .update({ tracked_email_id: trackedEmailId })
            .eq('id', bounce.id)
          matched++
        }
      }

      if (trackedEmailId) {
        // Process based on bounce type
        const followupsCancelled = await processBounceByType(
          supabase,
          trackedEmailId,
          bounce,
          config
        )
        totalFollowupsCancelled += followupsCancelled

        if (bounce.bounce_type === 'hard') {
          hardBounces++
        } else if (bounce.bounce_type === 'soft') {
          softBounces++
        }
      }

      // Mark bounce as processed
      await supabase
        .from('email_bounces')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          followups_cancelled: totalFollowupsCancelled
        })
        .eq('id', bounce.id)

    } catch (error) {
      console.error(`Error processing bounce ${bounce.id}:`, error)
    }
  }

  return {
    processed: bounces.length,
    matched,
    hard_bounces: hardBounces,
    soft_bounces: softBounces,
    followups_cancelled: totalFollowupsCancelled
  }
}

/**
 * Find tracked email for an unmatched bounce
 */
async function findTrackedEmailForBounce(
  supabase: any,
  bounce: UnprocessedBounce
): Promise<string | null> {
  // Strategy 1: Match by recipient and subject
  if (bounce.failed_recipients && bounce.failed_recipients.length > 0) {
    const { data: emails } = await supabase
      .from('tracked_emails')
      .select('id, subject, sent_at')
      .contains('recipient_emails', bounce.failed_recipients)
      .eq('status', 'pending')

    if (emails && emails.length > 0) {
      // If we have original subject, try to match it
      if (bounce.original_subject) {
        const exactMatch = emails.find((e: any) => e.subject === bounce.original_subject)
        if (exactMatch) {
          console.log(`Matched bounce to email ${exactMatch.id} by recipient and subject`)
          return exactMatch.id
        }
      }

      // Otherwise, return the most recent email to that recipient
      const mostRecent = emails.sort((a: any, b: any) =>
        new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      )[0]

      if (mostRecent) {
        console.log(`Matched bounce to email ${mostRecent.id} by recipient (most recent)`)
        return mostRecent.id
      }
    }
  }

  // Strategy 2: Match by subject alone (if unique enough)
  if (bounce.original_subject) {
    const { data: email } = await supabase
      .from('tracked_emails')
      .select('id')
      .eq('subject', bounce.original_subject)
      .eq('status', 'pending')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (email) {
      console.log(`Matched bounce to email ${email.id} by subject`)
      return email.id
    }
  }

  console.log('Could not find tracked email for bounce')
  return null
}

/**
 * Process bounce based on type and config
 */
async function processBounceByType(
  supabase: any,
  trackedEmailId: string,
  bounce: UnprocessedBounce,
  config: BounceConfig
): Promise<number> {
  let followupsCancelled = 0

  if (bounce.bounce_type === 'hard' || config.hard_bounce_action === 'stop_immediately') {
    // Hard bounce: Stop everything immediately
    console.log(`🛑 Processing hard bounce for email ${trackedEmailId}`)

    // Mark email as bounced using the SQL function
    await supabase.rpc('mark_email_as_bounced', {
      p_tracked_email_id: trackedEmailId,
      p_bounce_type: bounce.bounce_type,
      p_bounce_reason: bounce.bounce_reason
    })

    // Count cancelled followups
    const { count } = await supabase
      .from('followups')
      .select('*', { count: 'exact', head: true })
      .eq('tracked_email_id', trackedEmailId)
      .eq('status', 'cancelled')

    followupsCancelled = count || 0

  } else if (bounce.bounce_type === 'soft') {
    // Soft bounce: Check retry limit
    console.log(`⚠️ Processing soft bounce for email ${trackedEmailId}`)

    // Check current bounce count
    const { data: email } = await supabase
      .from('tracked_emails')
      .select('bounce_count')
      .eq('id', trackedEmailId)
      .single()

    if (email) {
      const currentCount = email.bounce_count || 0

      if (currentCount >= config.soft_bounce_retry_limit) {
        // Exceeded retry limit, treat as hard bounce
        console.log(`Max soft bounces reached (${currentCount}/${config.soft_bounce_retry_limit}), stopping`)

        await supabase.rpc('mark_email_as_bounced', {
          p_tracked_email_id: trackedEmailId,
          p_bounce_type: 'soft',
          p_bounce_reason: `Soft bounce limit exceeded (${currentCount} bounces)`
        })

        // Count cancelled followups
        const { count } = await supabase
          .from('followups')
          .select('*', { count: 'exact', head: true })
          .eq('tracked_email_id', trackedEmailId)
          .eq('status', 'cancelled')

        followupsCancelled = count || 0

      } else {
        // Under limit, delay next followup
        console.log(`Soft bounce ${currentCount + 1}/${config.soft_bounce_retry_limit}, delaying next followup`)

        // Update bounce count
        await supabase
          .from('tracked_emails')
          .update({
            bounce_count: currentCount + 1,
            bounce_type: 'soft',
            bounce_detected_at: new Date().toISOString(),
            bounce_reason: bounce.bounce_reason
          })
          .eq('id', trackedEmailId)

        // Delay next scheduled followup
        const delayHours = config.soft_bounce_retry_delay_hours
        const newScheduledTime = new Date(Date.now() + delayHours * 60 * 60 * 1000)

        await supabase
          .from('followups')
          .update({
            scheduled_for: newScheduledTime.toISOString(),
            failure_reason: `Delayed due to soft bounce (attempt ${currentCount + 1})`
          })
          .eq('tracked_email_id', trackedEmailId)
          .eq('status', 'scheduled')
      }
    }
  }

  return followupsCancelled
}

/**
 * Check bounce rates and send alerts if needed
 */
async function checkBounceRatesAndAlert(
  supabase: any,
  config: BounceConfig
): Promise<{
  checked: boolean,
  alerts_sent: number,
  critical_mailboxes: string[],
  warning_mailboxes: string[]
}> {
  // Get bounce rates from the view
  const { data: bounceRates, error } = await supabase
    .from('mailbox_bounce_rates')
    .select('*')

  if (error) {
    console.error('Failed to get bounce rates:', error)
    return {
      checked: false,
      alerts_sent: 0,
      critical_mailboxes: [],
      warning_mailboxes: []
    }
  }

  const criticalMailboxes: string[] = []
  const warningMailboxes: string[] = []
  let alertsSent = 0

  for (const mailbox of bounceRates || []) {
    if (mailbox.health_status === 'critical') {
      criticalMailboxes.push(mailbox.email_address)

      // Auto-disable if over threshold
      if (mailbox.bounce_rate_percent >= config.auto_disable_threshold_percent) {
        console.log(`🚨 Auto-disabling mailbox ${mailbox.email_address} (${mailbox.bounce_rate_percent}% bounce rate)`)

        await supabase
          .from('mailboxes')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', mailbox.mailbox_id)

        // Create alert record
        await createBounceAlert(
          supabase,
          mailbox.mailbox_id,
          'critical',
          `Mailbox auto-disabled due to ${mailbox.bounce_rate_percent}% bounce rate`
        )
        alertsSent++
      }

    } else if (mailbox.health_status === 'warning') {
      warningMailboxes.push(mailbox.email_address)

      // Create warning alert
      await createBounceAlert(
        supabase,
        mailbox.mailbox_id,
        'warning',
        `Mailbox has ${mailbox.bounce_rate_percent}% bounce rate`
      )
      alertsSent++
    }
  }

  if (criticalMailboxes.length > 0) {
    console.log(`🚨 Critical bounce rates detected for: ${criticalMailboxes.join(', ')}`)
  }

  if (warningMailboxes.length > 0) {
    console.log(`⚠️ Warning bounce rates for: ${warningMailboxes.join(', ')}`)
  }

  return {
    checked: true,
    alerts_sent: alertsSent,
    critical_mailboxes: criticalMailboxes,
    warning_mailboxes: warningMailboxes
  }
}

/**
 * Create a bounce alert record
 */
async function createBounceAlert(
  supabase: any,
  mailboxId: string,
  severity: string,
  message: string
): Promise<void> {
  try {
    // Check if we already have a recent alert for this mailbox
    const { data: recentAlert } = await supabase
      .from('system_alerts')
      .select('id')
      .eq('entity_type', 'mailbox')
      .eq('entity_id', mailboxId)
      .eq('alert_type', 'bounce_rate')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
      .limit(1)
      .single()

    if (recentAlert) {
      console.log(`Alert already sent for mailbox ${mailboxId} in the last 24h`)
      return
    }

    // Create new alert
    await supabase
      .from('system_alerts')
      .insert({
        entity_type: 'mailbox',
        entity_id: mailboxId,
        alert_type: 'bounce_rate',
        severity,
        message,
        created_at: new Date().toISOString()
      })

  } catch (error) {
    console.error('Failed to create bounce alert:', error)
  }
}

/**
 * Get bounce statistics for reporting
 */
async function getBounceStatistics(supabase: any): Promise<any> {
  const { data: stats } = await supabase
    .from('bounce_statistics')
    .select('*')
    .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
    .order('date', { ascending: false })

  return stats || []
}