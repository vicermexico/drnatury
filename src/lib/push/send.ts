import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderTemplate } from "@/lib/whatsapp/templates";
import type { TemplateKey } from "@/lib/whatsapp/templates";

export interface PushResult {
  sent: boolean;
  error?: string;
}

export async function sendPushNotification(
  patientId: string,
  templateKey: TemplateKey,
  vars: Record<string, string>
): Promise<PushResult> {
  const tag = `[PUSH -> ${patientId} | ${templateKey}]`;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("push_token, name")
    .eq("id", patientId)
    .single();

  if (!profile?.push_token) {
    console.log(`${tag} Sin push_token, no se envia`);
    return { sent: false, error: "No push token" };
  }

  const { data: template, error: tplError } = await admin
    .from("whatsapp_templates")
    .select("body")
    .eq("key", templateKey)
    .single();

  if (tplError || !template) {
    console.error(`${tag} Template no encontrado:`, tplError?.message);
    return { sent: false, error: `Template "${templateKey}" not found` };
  }

  const message = renderTemplate(template.body, vars);

  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getMessaging } = await import("firebase-admin/messaging");

    if (!getApps().length) {
      let credentials;
      if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
        credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      } else {
        const fs = await import("fs");
        credentials = JSON.parse(
          fs.readFileSync(process.cwd() + "/firebase-adminsdk.json", "utf8")
        );
      }
      initializeApp({ credential: cert(credentials) });
    }

    await getMessaging().send({
      token: profile.push_token,
      notification: {
        title: "DrNatury",
        body: message,
      },
    });
    console.log(`${tag} Enviado`);
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} Error:`, msg);
    return { sent: false, error: msg };
  }
}
