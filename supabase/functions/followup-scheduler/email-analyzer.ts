import {
  EdgeSupabaseClient,
  TrackedEmailWithFollowupInfo
} from './shared-types.ts';

/**
 * Récupère les emails nécessitant des relances avec analyse d'activité
 */
export async function getEmailsNeedingFollowup(
  supabase: EdgeSupabaseClient
): Promise<TrackedEmailWithFollowupInfo[]> {
  // Récupérer tous les emails pending nécessitant des relances
  const { data: emailsData, error: emailsError } = await supabase
    .from('tracked_emails')
    .select('*')
    .eq('status', 'pending')
    .order('sent_at', { ascending: true });

  console.log(`📧 Found ${emailsData?.length || 0} pending emails to process`);

  if (emailsError) {
    throw new Error(`Failed to fetch emails: ${emailsError.message}`);
  }

  if (!emailsData || emailsData.length === 0) {
    return [];
  }

  // Pour chaque email, enrichir avec les données de relances et vérifier les bounces
  const enrichedEmails = [];
  for (const email of emailsData) {
    // Check if email has bounced - skip if it has
    const bounceStatus = await checkEmailBounceStatus(supabase, email.id);
    if (bounceStatus.has_bounced && !bounceStatus.can_retry) {
      console.log(`📧 Skipping email ${email.id} - bounced (${bounceStatus.bounce_type}: ${bounceStatus.bounce_reason})`);
      continue;
    }

    const enrichedEmail = await enrichEmailWithFollowupData(supabase, email);
    enrichedEmails.push(enrichedEmail);
  }

  console.log(`📊 Enriched ${enrichedEmails.length} emails with followup data`);
  return enrichedEmails;
}

/**
 * Enrichit un email avec les données de relances (automatiques + manuelles)
 */
async function enrichEmailWithFollowupData(
  supabase: EdgeSupabaseClient,
  email: any
): Promise<TrackedEmailWithFollowupInfo> {
  // Récupérer les relances automatiques
  const { data: followupData, error: followupError } = await supabase
    .from('followups')
    .select('followup_number, sent_at')
    .eq('tracked_email_id', email.id)
    .order('followup_number', { ascending: false })
    .limit(1);

  if (followupError) {
    console.error(`Error fetching followups for ${email.id}:`, followupError);
  }

  // Récupérer les relances manuelles
  const { data: manualFollowupData, error: manualError } = await supabase
    .from('manual_followups')
    .select('followup_sequence_number, detected_at')
    .eq('tracked_email_id', email.id)
    .order('detected_at', { ascending: false })
    .limit(1);

  if (manualError) {
    console.error(`Error fetching manual followups for ${email.id}:`, manualError);
  }

  const lastAutomaticFollowup = followupData?.[0];
  const lastManualFollowup = manualFollowupData?.[0];

  // Analyser l'activité pour déterminer la dernière action
  const activityAnalysis = analyzeLastActivity(
    email,
    lastAutomaticFollowup,
    lastManualFollowup
  );

  // Calculer le nombre total de relances
  const totalFollowups = await getTotalFollowupsForEmail(supabase, email.id);

  return {
    ...email,
    last_followup_number: lastAutomaticFollowup?.followup_number || 0,
    last_followup_at: lastAutomaticFollowup?.sent_at || null,
    last_manual_followup_at: lastManualFollowup?.detected_at || null,
    last_activity_at: activityAnalysis.lastActivity.toISOString(),
    last_activity_type: activityAnalysis.lastActivityType,
    total_followups: totalFollowups
  };
}

/**
 * Analyse l'activité d'un email pour déterminer la dernière action
 */
function analyzeLastActivity(
  email: any,
  lastAutomaticFollowup: any,
  lastManualFollowup: any
): {
  lastActivity: Date;
  lastActivityType: 'automatic' | 'manual' | 'original';
} {
  const automaticAt = lastAutomaticFollowup?.sent_at
    ? new Date(lastAutomaticFollowup.sent_at)
    : null;
  const manualAt = lastManualFollowup?.detected_at
    ? new Date(lastManualFollowup.detected_at)
    : null;

  let lastActivity: Date;
  let lastActivityType: 'automatic' | 'manual' | 'original';

  if (automaticAt && manualAt) {
    if (automaticAt > manualAt) {
      lastActivity = automaticAt;
      lastActivityType = 'automatic';
    } else {
      lastActivity = manualAt;
      lastActivityType = 'manual';
    }
  } else if (automaticAt) {
    lastActivity = automaticAt;
    lastActivityType = 'automatic';
  } else if (manualAt) {
    lastActivity = manualAt;
    lastActivityType = 'manual';
  } else {
    lastActivity = new Date(email.sent_at);
    lastActivityType = 'original';
  }

  return { lastActivity, lastActivityType };
}

/**
 * Calcule le nombre total de relances (automatiques + manuelles) pour un email
 */
export async function getTotalFollowupsForEmail(
  supabase: EdgeSupabaseClient,
  trackedEmailId: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .rpc('get_total_followup_count', { p_tracked_email_id: trackedEmailId });

    if (error) {
      console.error(`Error getting total followup count for ${trackedEmailId}:`, error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error(`Error calling get_total_followup_count:`, error);
    return 0;
  }
}

/**
 * Check if an email has bounced and whether retry is allowed
 */
async function checkEmailBounceStatus(
  supabase: EdgeSupabaseClient,
  trackedEmailId: string
): Promise<{
  has_bounced: boolean;
  bounce_type?: string;
  bounce_reason?: string;
  can_retry: boolean;
  retry_count: number;
}> {
  try {
    const { data, error } = await supabase
      .rpc('check_email_bounce_status', { p_tracked_email_id: trackedEmailId })
      .single();

    if (error) {
      console.error(`Error checking bounce status for ${trackedEmailId}:`, error);
      return { has_bounced: false, can_retry: true, retry_count: 0 };
    }

    return {
      has_bounced: data.has_bounced,
      bounce_type: data.bounce_type,
      bounce_reason: data.bounce_reason,
      can_retry: data.can_retry,
      retry_count: data.retry_count
    };
  } catch (error) {
    console.error(`Error calling check_email_bounce_status:`, error);
    return { has_bounced: false, can_retry: true, retry_count: 0 };
  }
}