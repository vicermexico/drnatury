import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderTemplate } from "@/lib/whatsapp/templates";
import type { TemplateKey } from "@/lib/whatsapp/templates";

export interface PushResult {
  sent: boolean;
  error?: string;
}

// Separado de sendPushNotification (que SIEMPRE lee el texto de un
// whatsapp_template, porque esos mensajes son para pacientes -- ver
// regla de CLAUDE.md de que un WhatsApp template nunca va hardcoded).
// Esto es distinto: son avisos INTERNOS para el staff (ej. "Apoyo con
// Cliente" cuando al bot se le complica una conversacion), no mensajes
// de WhatsApp a pacientes, asi que si pueden traer su texto fijo.
export async function enviarPushDirecto(
  pushToken: string,
  title: string,
  body: string,
  url?: string
): Promise<PushResult> {
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
      token: pushToken,
      notification: { title, body },
      data: url ? { url } : undefined,
    });
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { sent: false, error: msg };
  }
}

// Manda un aviso a TODO el staff que tenga el rol MASTER y ya haya
// activado las notificaciones (ver ActivarNotificacionesApoyo.tsx).
// Compartido por notificarApoyoConCliente y notificarSeguimientoPendiente.
async function enviarATodosLosMaestros(tag: string, title: string, body: string, url: string): Promise<void> {
  const admin = createAdminClient();
  const { data: maestros } = await admin
    .from("profiles")
    .select("push_token")
    .contains("roles", ["MASTER"])
    .not("push_token", "is", null);

  const tokens = (maestros ?? []).map((m) => m.push_token as string).filter(Boolean);
  if (tokens.length === 0) {
    console.log(`${tag} Nadie tiene notificaciones activadas todavia`);
    return;
  }

  await Promise.all(tokens.map((token) => enviarPushDirecto(token, title, body, url)));
  console.log(`${tag} Enviado a ${tokens.length} dispositivo(s)`);
}

// Cuando el Asistente de WhatsApp (chat publico, /chat) no supo
// contestar algo y le dio la respuesta generica de "¡Con gusto le
// ayudo!..." (ver nota "no_entendido_publico" en engine.ts), se avisa
// por push a Master -- el aviso lleva directo a esa conversacion en el
// panel de revision. No bloquea la respuesta al paciente si falla: es
// best-effort, nunca se espera a que termine antes de contestarle.
export async function notificarApoyoConCliente(conversacionId: string, ultimoMensaje: string): Promise<void> {
  const tag = `[PUSH apoyo-con-cliente -> ${conversacionId}]`;
  try {
    const cuerpo = ultimoMensaje.length > 120 ? `${ultimoMensaje.slice(0, 117)}...` : ultimoMensaje;
    await enviarATodosLosMaestros(tag, "Apoyo con Cliente", cuerpo, `/master/asistente-whatsapp/revision/${conversacionId}`);
  } catch (err) {
    console.error(`${tag} Error:`, err instanceof Error ? err.message : err);
  }
}

// Cuando un visitante del chat publico se quedo a medias (ver CRON
// /api/cron/recordatorio-chat) y NO activo su propia notificacion pero
// si dejo su celular durante la platica, se le avisa a Master para que
// le mande el link de regreso por WhatsApp a mano (ver boton "Mandar
// por WhatsApp" en /master/asistente-whatsapp/revision/[id]).
export async function notificarSeguimientoPendiente(conversacionId: string, ultimaPreguntaBot: string): Promise<void> {
  const tag = `[PUSH seguimiento-pendiente -> ${conversacionId}]`;
  try {
    const cuerpo = `Se quedó a medias: "${ultimaPreguntaBot.length > 100 ? `${ultimaPreguntaBot.slice(0, 97)}...` : ultimaPreguntaBot}"`;
    await enviarATodosLosMaestros(tag, "Seguimiento pendiente", cuerpo, `/master/asistente-whatsapp/revision/${conversacionId}`);
  } catch (err) {
    console.error(`${tag} Error:`, err instanceof Error ? err.message : err);
  }
}

export async function sendPushNotification(
  patientId: string,
  templateKey: TemplateKey,
  vars: Record<string, string>,
  url?: string
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
      data: url ? { url } : undefined,
    });
    console.log(`${tag} Enviado`);
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} Error:`, msg);
    return { sent: false, error: msg };
  }
}
