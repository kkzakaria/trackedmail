#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const EMAIL = "service-exploitation@karta-transit.ci";

// Créer le client Supabase avec la clé service_role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  try {
    console.log(`📧 Processing email: ${EMAIL}`);

    // 1. Vérifier si la mailbox existe déjà
    const { data: existingMailbox } = await supabase
      .from("mailboxes")
      .select("*")
      .eq("email_address", EMAIL)
      .single();

    let mailbox;

    if (existingMailbox) {
      console.log("✅ Mailbox already exists:", existingMailbox.id);
      mailbox = existingMailbox;
    } else {
      console.log("📝 Creating new mailbox...");

      // Pour le moment, créer une mailbox sans microsoft_user_id
      // (dans un environnement réel, on utiliserait Microsoft Graph pour le résoudre)
      const { data: newMailbox, error: createError } = await supabase
        .from("mailboxes")
        .insert({
          email_address: EMAIL,
          display_name: "Service Exploitation",
          microsoft_user_id: "placeholder-" + Date.now(), // Temporaire
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      mailbox = newMailbox;
      console.log("✅ Mailbox created:", mailbox.id);
    }

    // 2. Créer la souscription webhook
    console.log("🔔 Creating webhook subscription...");

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/microsoft-subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          mailboxId: mailbox.id,
          userId: mailbox.microsoft_user_id,
          changeTypes: ["created", "updated"],
          expirationHours: 72,
        }),
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log("✅ Webhook subscription created successfully!");
      console.log("   Subscription ID:", result.subscription?.id);
      console.log("   Resource:", result.subscription?.resource);
      console.log("   Expires at:", result.subscription?.expiresAt);
    } else {
      console.error("❌ Failed to create subscription:", result);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main();
