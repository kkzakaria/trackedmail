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

    // 0. Vérifier si le système de relances est activé
    const isFollowupEnabled = await checkFollowupSystemEnabled(supabase);
    if (!isFollowupEnabled) {
      console.log('⚠️ Followup system is disabled. Skipping sending.');
      return new Response(JSON.stringify({
        success: true,
        message: 'Followup system is disabled',
        sent: 0,
        failed: 0,
        total_processed: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

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
        const errorMsg = `Failed to send followup ${followup.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
        failedCount++;

        // Marquer comme échec dans la base de données
        await markFollowupAsFailed(supabase, followup.id, error instanceof Error ? error.message : String(error));
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
      error: error instanceof Error ? error.message : String(error),
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
 * Envoie une relance via Microsoft Graph avec threading et headers personnalisés
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

  // Récupérer l'email original pour maintenir le threading
  const { data: originalEmail, error: emailError } = await supabase
    .from('tracked_emails')
    .select('internet_message_id, conversation_id, microsoft_message_id')
    .eq('id', followup.tracked_email_id)
    .single();

  if (emailError || !originalEmail) {
    throw new Error(`Failed to fetch original email details: ${emailError?.message || 'Not found'}`);
  }

  console.log(`📨 Preparing followup ${followup.followup_number} for tracked email ${followup.tracked_email_id}`);
  console.log(`   Original conversation: ${originalEmail.conversation_id}`);
  console.log(`   Original message ID: ${originalEmail.internet_message_id}`);
  console.log(`   Microsoft message ID: ${originalEmail.microsoft_message_id || 'NOT FOUND'}`);

  // Construire le message avec headers personnalisés pour le threading et l'identification
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
    },
    // Headers personnalisés pour identifier les relances (Microsoft Graph n'accepte que X- headers)
    internetMessageHeaders: [
      {
        name: 'X-TrackedMail-Followup',
        value: 'true'
      },
      {
        name: 'X-TrackedMail-System',
        value: 'automated-followup'
      },
      {
        name: 'X-TrackedMail-Data',
        value: `${followup.followup_number}:${followup.tracked_email_id}:${followup.id}`
      },
      {
        name: 'X-TrackedMail-Threading',
        value: `${originalEmail.conversation_id}:${originalEmail.internet_message_id}`
      }
    ],
    // Conserver le conversationId pour le threading
    conversationId: originalEmail.conversation_id
  };

  // Utiliser l'API Reply pour un meilleur threading
  let graphUrl: string;
  let requestBody: any;

  if (originalEmail.microsoft_message_id) {
    // Utiliser l'API Reply pour maintenir le threading natif
    console.log(`📮 Using Reply API with custom headers (followup #${followup.followup_number})`);
    graphUrl = `https://graph.microsoft.com/v1.0/users/${microsoftUserId}/messages/${originalEmail.microsoft_message_id}/reply`;
    requestBody = { message: messageData };
  } else {
    // Fallback vers sendMail si pas de microsoft_message_id
    console.log(`📮 Using SendMail API with custom headers (followup #${followup.followup_number}) - no message ID`);
    graphUrl = `https://graph.microsoft.com/v1.0/users/${microsoftUserId}/sendMail`;
    requestBody = { message: messageData };
  }

  console.log(`🚀 Sending request to: ${graphUrl}`);

  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Microsoft Graph API Error: ${response.status}`);
    console.error(`   Error details: ${errorText}`);
    throw new Error(`Failed to send followup via Microsoft Graph: ${response.status} ${errorText}`);
  }

  // Marquer la relance comme envoyée
  await markFollowupAsSent(supabase, followup.id);

  console.log(`✅ Successfully sent followup ${followup.followup_number} for email ${followup.tracked_email_id}`);
  console.log(`   Method used: ${originalEmail.microsoft_message_id ? 'Reply API with native threading' : 'SendMail with custom threading'}`);
  console.log(`   Threading maintained via: ${originalEmail.conversation_id}`);
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