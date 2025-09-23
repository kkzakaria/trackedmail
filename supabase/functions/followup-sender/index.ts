import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  EdgeSupabaseClient,
  TrackedEmailRow,
  FollowupRow
} from '../_shared/types.ts';

// Types pour le système de relances
interface FollowupToSend extends FollowupRow {
  tracked_email: {
    id: string;
    sender_email: string;
    recipient_emails: string[];
    mailbox: {
      id: string;
      email_address: string;
      microsoft_user_id: string;
    };
  };
}

interface MicrosoftGraphToken {
  encrypted_token: string;
  expires_at: string;
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')!;
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;
const MICROSOFT_TENANT_ID = Deno.env.get('MICROSOFT_TENANT_ID')!;

console.log('📧 Followup Sender Function Started');

serve(async (req) => {
  try {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    console.log('📮 Starting followup sending process...');

    // Créer le client Supabase avec les droits de service
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Récupérer les relances prêtes à être envoyées
    const followupsToSend = await getFollowupsToSend(supabase);
    console.log(`📧 Found ${followupsToSend.length} followups ready to send`);

    if (followupsToSend.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No followups ready to send',
        sent: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 2. Obtenir un token d'accès Microsoft Graph
    const accessToken = await getMicrosoftGraphToken();

    // 3. Traiter chaque relance
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const followup of followupsToSend) {
      try {
        await sendFollowup(supabase, followup, accessToken);
        sentCount++;
        console.log(`✅ Sent followup ${followup.id}`);
      } catch (error) {
        const errorMsg = `Failed to send followup ${followup.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
        failedCount++;

        // Marquer comme échec dans la base de données
        await markFollowupAsFailed(supabase, followup.id, error.message);
      }
    }

    console.log(`🎯 Sending completed. Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Followup sending completed',
      sent: sentCount,
      failed: failedCount,
      total_processed: followupsToSend.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Followup Sender Error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

/**
 * Récupère les relances prêtes à être envoyées
 */
async function getFollowupsToSend(supabase: EdgeSupabaseClient): Promise<FollowupToSend[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('followups')
    .select(`
      *,
      tracked_email:tracked_emails!inner(
        id,
        sender_email,
        recipient_emails,
        status,
        mailbox:mailboxes!inner(
          id,
          email_address,
          microsoft_user_id,
          is_active
        )
      )
    `)
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .eq('tracked_email.status', 'pending') // Email toujours en attente
    .eq('tracked_email.mailbox.is_active', true) // Boîte mail active
    .order('scheduled_for', { ascending: true })
    .limit(10); // Traiter par batch de 10

  if (error) {
    throw new Error(`Failed to fetch followups to send: ${error.message}`);
  }

  return data || [];
}

/**
 * Obtient un token d'accès Microsoft Graph
 */
async function getMicrosoftGraphToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', MICROSOFT_CLIENT_ID);
  params.append('client_secret', MICROSOFT_CLIENT_SECRET);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Microsoft Graph token: ${response.status} ${errorText}`);
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

/**
 * Envoie une relance via Microsoft Graph
 */
async function sendFollowup(
  supabase: EdgeSupabaseClient,
  followup: FollowupToSend,
  accessToken: string
): Promise<void> {
  const microsoftUserId = followup.tracked_email.mailbox.microsoft_user_id;

  if (!microsoftUserId) {
    throw new Error('Microsoft User ID not found for mailbox');
  }

  // Construire le message
  const messageData = {
    subject: followup.subject,
    body: {
      contentType: 'HTML',
      content: convertTextToHtml(followup.body)
    },
    toRecipients: followup.tracked_email.recipient_emails.map(email => ({
      emailAddress: { address: email }
    })),
    from: {
      emailAddress: { address: followup.tracked_email.mailbox.email_address }
    }
  };

  // Envoyer via Microsoft Graph
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${microsoftUserId}/sendMail`;

  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: messageData }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Microsoft Graph API Error: ${response.status} ${errorText}`);
    throw new Error(`Failed to send email via Microsoft Graph: ${response.status} ${errorText}`);
  }

  // Marquer la relance comme envoyée
  await markFollowupAsSent(supabase, followup.id);

  console.log(`📧 Successfully sent followup ${followup.followup_number} for email ${followup.tracked_email_id}`);
}

/**
 * Marque une relance comme envoyée
 */
async function markFollowupAsSent(supabase: EdgeSupabaseClient, followupId: string): Promise<void> {
  const { error } = await supabase
    .from('followups')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('id', followupId);

  if (error) {
    console.error(`Failed to mark followup ${followupId} as sent:`, error);
    throw new Error(`Failed to update followup status: ${error.message}`);
  }
}

/**
 * Marque une relance comme échouée
 */
async function markFollowupAsFailed(
  supabase: EdgeSupabaseClient,
  followupId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('followups')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: errorMessage.substring(0, 500) // Limiter la taille
    })
    .eq('id', followupId);

  if (error) {
    console.error(`Failed to mark followup ${followupId} as failed:`, error);
  }
}

/**
 * Convertit le texte en HTML simple
 */
function convertTextToHtml(text: string): string {
  return text
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

/**
 * Fonction pour gérer les retry automatiques
 */
async function handleRetryableError(
  supabase: EdgeSupabaseClient,
  followupId: string,
  error: Error,
  retryCount: number = 0
): Promise<void> {
  const maxRetries = 3;

  if (retryCount < maxRetries && isRetryableError(error)) {
    // Reprogrammer la relance dans 15 minutes
    const newScheduledTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('followups')
      .update({
        scheduled_for: newScheduledTime,
        failure_reason: `Retry ${retryCount + 1}/${maxRetries}: ${error.message}`
      })
      .eq('id', followupId);

    if (updateError) {
      console.error(`Failed to reschedule followup ${followupId}:`, updateError);
    } else {
      console.log(`🔄 Rescheduled followup ${followupId} for retry ${retryCount + 1}`);
    }
  } else {
    // Marquer comme échec définitif
    await markFollowupAsFailed(supabase, followupId, error.message);
  }
}

/**
 * Détermine si une erreur est "retryable"
 */
function isRetryableError(error: Error): boolean {
  const retryableErrors = [
    'network',
    'timeout',
    'rate limit',
    'throttl',
    '429',
    '500',
    '502',
    '503',
    '504'
  ];

  const errorMessage = error.message.toLowerCase();
  return retryableErrors.some(keyword => errorMessage.includes(keyword));
}

/**
 * Fonction pour nettoyer les relances expirées
 */
async function cleanupExpiredFollowups(supabase: EdgeSupabaseClient): Promise<void> {
  // Marquer comme expirées les relances programmées depuis plus de 7 jours
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('followups')
    .update({
      status: 'cancelled',
      failure_reason: 'Expired - not sent within 7 days'
    })
    .eq('status', 'scheduled')
    .lt('scheduled_for', sevenDaysAgo);

  if (error) {
    console.error('Failed to cleanup expired followups:', error);
  } else {
    console.log('✅ Cleaned up expired followups');
  }
}