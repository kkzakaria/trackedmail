#!/usr/bin/env node

import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

// Configuration Microsoft - Enlever les quotes supplémentaires
const TENANT_ID = process.env.MICROSOFT_TENANT_ID?.replace(/['"]/g, "");
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID?.replace(/['"]/g, "");
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET?.replace(/['"]/g, "");
const EMAIL = "service-exploitation@karta-transit.ci";

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Missing Microsoft credentials in .env.local");
  process.exit(1);
}

async function main() {
  try {
    console.log("🔍 Resolving email:", EMAIL);
    console.log("   Tenant ID:", TENANT_ID);
    console.log("   Client ID:", CLIENT_ID);

    // Créer les credentials
    const credential = new ClientSecretCredential(
      TENANT_ID,
      CLIENT_ID,
      CLIENT_SECRET
    );

    // Créer le client Microsoft Graph
    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken([
            "https://graph.microsoft.com/.default",
          ]);
          return token.token;
        },
      },
    });

    // Rechercher l'utilisateur par email
    console.log("\n📧 Searching for user...");
    const users = await client
      .api("/users")
      .filter(`mail eq '${EMAIL}' or userPrincipalName eq '${EMAIL}'`)
      .select([
        "id",
        "userPrincipalName",
        "displayName",
        "mail",
        "jobTitle",
        "department",
      ])
      .get();

    if (users.value && users.value.length > 0) {
      const user = users.value[0];
      console.log("\n✅ User found!");
      console.log("   ID:", user.id);
      console.log("   Display Name:", user.displayName);
      console.log("   Mail:", user.mail);
      console.log("   UPN:", user.userPrincipalName);
      console.log("   Job Title:", user.jobTitle);
      console.log("   Department:", user.department);

      return {
        microsoft_user_id: user.id,
        email_address: user.mail || user.userPrincipalName,
        display_name: user.displayName,
      };
    } else {
      console.log("❌ User not found");
      return null;
    }
  } catch (error) {
    console.error("❌ Error:", error);
    if (error.response) {
      console.error("   Response:", error.response.data);
    }
  }
}

main();
