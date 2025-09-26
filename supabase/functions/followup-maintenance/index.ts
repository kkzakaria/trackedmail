import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  EdgeSupabaseClient
} from '../_shared/types.ts';

// Interface pour le retour de la fonction RPC get_emails_with_max_followups
interface EmailWithMaxFollowups {
  id: string;
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

console.log('🔧 Followup Maintenance Function Started');

Deno.serve(async (req) => {
  try {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    console.log('🧹 Starting followup maintenance process...');

    // Créer le client Supabase avec les droits de service
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 0. Vérifier si le système de relances est activé
    const isFollowupEnabled = await checkFollowupSystemEnabled(supabase);
    if (!isFollowupEnabled) {
      console.log('⚠️ Followup system is disabled. Skipping maintenance.');
      return new Response(JSON.stringify({
        success: true,
        message: 'Followup system is disabled',
        cancelled_followups: 0,
        cleaned_followups: 0,
        updated_emails: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let totalCancelled = 0;
    let totalCleaned = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    try {
      // 1. Annuler les relances pour les emails ayant reçu des réponses
      console.log('🚫 Cancelling followups for emails with responses...');
      const cancelledCount = await cancelFollowupsForRespondedEmails(supabase);
      totalCancelled = cancelledCount;
      console.log(`✅ Cancelled ${cancelledCount} followups for responded emails`);
    } catch (error) {
      const errorMsg = `Error cancelling followups: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }

    try {
      // 2. Nettoyer les relances expirées
      console.log('🗑️ Cleaning up expired followups...');
      const cleanedCount = await cleanupExpiredFollowups(supabase);
      totalCleaned = cleanedCount;
      console.log(`✅ Cleaned ${cleanedCount} expired followups`);
    } catch (error) {
      const errorMsg = `Error cleaning expired followups: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }

    try {
      // 3. Mettre à jour les statuts des emails trackés
      console.log('📊 Updating tracked email statuses...');
      const updatedCount = await updateEmailStatuses(supabase);
      totalUpdated = updatedCount;
      console.log(`✅ Updated ${updatedCount} email statuses`);
    } catch (error) {
      const errorMsg = `Error updating email statuses: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }

    console.log(`🎯 Maintenance completed:`);
    console.log(`   🚫 Cancelled followups: ${totalCancelled}`);
    console.log(`   🗑️ Cleaned expired: ${totalCleaned}`);
    console.log(`   📊 Updated emails: ${totalUpdated}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Followup maintenance completed',
      cancelled_followups: totalCancelled,
      cleaned_followups: totalCleaned,
      updated_emails: totalUpdated,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Followup Maintenance Error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

/**
 * Annule les relances pour les emails ayant reçu des réponses
 */
async function cancelFollowupsForRespondedEmails(supabase: EdgeSupabaseClient): Promise<number> {
  // Récupérer les emails qui ont reçu des réponses mais ont encore des relances programmées
  const { data: emailsWithResponses, error: emailsError } = await supabase
    .from('tracked_emails')
    .select(`
      id,
      followups!inner(
        id,
        status
      )
    `)
    .eq('status', 'responded')
    .in('followups.status', ['scheduled']);

  if (emailsError) {
    throw new Error(`Failed to fetch emails with responses: ${emailsError.message}`);
  }

  if (!emailsWithResponses || emailsWithResponses.length === 0) {
    console.log('📭 No emails with responses have scheduled followups');
    return 0;
  }

  let cancelledCount = 0;

  // Pour chaque email ayant reçu une réponse, annuler ses relances programmées
  for (const email of emailsWithResponses) {
    try {
      const followupIds = email.followups.map(f => f.id);

      if (followupIds.length > 0) {
        const { error: cancelError } = await supabase
          .from('followups')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            failure_reason: 'Email received response during maintenance check'
          })
          .in('id', followupIds);

        if (cancelError) {
          console.error(`❌ Failed to cancel followups for email ${email.id}:`, cancelError);
        } else {
          cancelledCount += followupIds.length;
          console.log(`🚫 Cancelled ${followupIds.length} followups for responded email ${email.id}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing email ${email.id}:`, error);
    }
  }

  return cancelledCount;
}

/**
 * Nettoie les relances expirées (programmées depuis plus de 7 jours)
 */
async function cleanupExpiredFollowups(supabase: EdgeSupabaseClient): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`🗑️ Cleaning followups scheduled before: ${sevenDaysAgo}`);

  const { data: expiredFollowups, error: countError } = await supabase
    .from('followups')
    .select('id')
    .eq('status', 'scheduled')
    .lt('scheduled_for', sevenDaysAgo);

  if (countError) {
    throw new Error(`Failed to count expired followups: ${countError.message}`);
  }

  const expiredCount = expiredFollowups?.length || 0;

  if (expiredCount === 0) {
    console.log('📭 No expired followups to clean');
    return 0;
  }

  console.log(`🗑️ Found ${expiredCount} expired followups to clean`);

  const { error: cleanupError } = await supabase
    .from('followups')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      failure_reason: 'Expired - not sent within 7 days'
    })
    .eq('status', 'scheduled')
    .lt('scheduled_for', sevenDaysAgo);

  if (cleanupError) {
    throw new Error(`Failed to cleanup expired followups: ${cleanupError.message}`);
  }

  console.log(`✅ Cleaned up ${expiredCount} expired followups`);
  return expiredCount;
}

/**
 * Met à jour les statuts des emails trackés selon les règles métier
 */
async function updateEmailStatuses(supabase: EdgeSupabaseClient): Promise<number> {
  let updatedCount = 0;

  try {
    // 1. Marquer comme 'max_reached' les emails ayant atteint le maximum de relances
    const maxReachedCount = await markEmailsAsMaxReached(supabase);
    updatedCount += maxReachedCount;

    // 2. Marquer comme 'expired' les emails anciens sans activité
    const expiredCount = await markEmailsAsExpired(supabase);
    updatedCount += expiredCount;

    console.log(`📊 Status updates: ${maxReachedCount} max_reached, ${expiredCount} expired`);
  } catch (error) {
    console.error('❌ Error updating email statuses:', error);
    throw error;
  }

  return updatedCount;
}

/**
 * Marque comme 'max_reached' les emails ayant atteint le maximum de relances
 */
async function markEmailsAsMaxReached(supabase: EdgeSupabaseClient): Promise<number> {
  // Récupérer la configuration du maximum de relances
  const { data: followupConfig } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'followup_settings')
    .single();

  const maxFollowups = followupConfig?.value?.max_followups || 3;

  // Utiliser la fonction RPC pour identifier les emails ayant atteint le maximum
  const { data: emailsToUpdate, error: rpcError } = await supabase
    .rpc('get_emails_with_max_followups', { p_max_followups: maxFollowups }) as { data: EmailWithMaxFollowups[] | null, error: Error | null };

  if (rpcError) {
    console.error('❌ Error calling get_emails_with_max_followups:', rpcError);
    return 0;
  }

  if (!emailsToUpdate || emailsToUpdate.length === 0) {
    return 0;
  }

  const emailIds = emailsToUpdate.map((email: EmailWithMaxFollowups) => email.id);

  const { error: updateError } = await supabase
    .from('tracked_emails')
    .update({ status: 'max_reached' })
    .in('id', emailIds)
    .eq('status', 'pending');

  if (updateError) {
    console.error('❌ Failed to mark emails as max_reached:', updateError);
    return 0;
  }

  console.log(`📊 Marked ${emailIds.length} emails as max_reached`);
  return emailIds.length;
}

/**
 * Marque comme 'expired' les emails anciens sans activité (plus de 30 jours)
 */
async function markEmailsAsExpired(supabase: EdgeSupabaseClient): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: expiredEmails, error: selectError } = await supabase
    .from('tracked_emails')
    .select('id')
    .eq('status', 'pending')
    .lt('sent_at', thirtyDaysAgo);

  if (selectError) {
    console.error('❌ Failed to select expired emails:', selectError);
    return 0;
  }

  if (!expiredEmails || expiredEmails.length === 0) {
    return 0;
  }

  const emailIds = expiredEmails.map(email => email.id);

  const { error: updateError } = await supabase
    .from('tracked_emails')
    .update({ status: 'expired' })
    .in('id', emailIds);

  if (updateError) {
    console.error('❌ Failed to mark emails as expired:', updateError);
    return 0;
  }

  console.log(`📊 Marked ${emailIds.length} emails as expired (older than 30 days)`);
  return emailIds.length;
}

/**
 * Vérifie si le système de relances est activé
 */
async function checkFollowupSystemEnabled(supabase: EdgeSupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'followup_settings')
      .single();

    if (error) {
      console.error('Failed to check followup system status:', error);
      return false;
    }

    const settings = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    return settings.enabled !== false; // Par défaut activé si pas spécifié
  } catch (error) {
    console.error('Error parsing followup settings:', error);
    return false;
  }
}