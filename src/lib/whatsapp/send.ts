import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderTemplate } from "./templates";
import type { TemplateKey } from "./templates";

export interface SendResult {
  sent:   boolean;
  mode:   "WAWEB" | "CLOUD_API" | "LOG";
  error?: string;
}

export async function sendWhatsApp(
  to: string,
  templateKey: TemplateKey,
  vars: Record<string, string>
): Promise<SendResult> {
  const tag = `[WA → ${to} | ${templateKey}]`;
  const admin = createAdminClient();

  // 1. Obtener template (CLAUDE.md regla 7: nunca hardcoded)
  const { data: template, error: tplError } = await admin
    .from("whatsapp_templates")
    .select("body")
    .eq("key", templateKey)
    .single();

  if (tplError || !template) {
    console.error(`${tag} Template no encontrado en whatsapp_templates:`, tplError?.message);
    return { sent: false, mode: "LOG", error: `Template "${templateKey}" not found` };
  }

  const message = renderTemplate(template.body, vars);
  console.log(`${tag} Mensaje renderizado (${message.length} chars): "${message.slice(0, 80)}…"`);

  // 2. Leer modo activo desde settings
  const { data: modeSetting } = await admin
    .from("settings")
    .select("value")
    .eq("key", "whatsapp_mode")
    .single();

  const mode = (modeSetting?.value ?? "WAWEB") as "WAWEB" | "CLOUD_API";
  console.log(`${tag} Modo: ${mode}${modeSetting ? "" : " (default — fila whatsapp_mode no encontrada)"}`);

  if (mode === "CLOUD_API") return sendViaCloudAPI(to, message, tag);
  return sendViaWAWEB(to, message, tag);
}

async function sendViaWAWEB(to: string, message: string, tag: string): Promise<SendResult> {
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;

  if (!serviceUrl) {
    console.log(`${tag} WHATSAPP_SERVICE_URL no configurado — modo LOG`);
    console.log(`${tag} Mensaje que se enviaría:\n${message}`);
    return { sent: true, mode: "WAWEB" };
  }

  const admin = createAdminClient();

  // 3. Leer números activos
  const { data: numbers, error: numbersError } = await admin
    .from("whatsapp_numbers")
    .select("id, phone, display_order")
    .eq("is_active", true)
    .order("display_order");

  if (numbersError) {
    console.error(`${tag} Error al leer whatsapp_numbers:`, numbersError.message);
    return { sent: false, mode: "WAWEB", error: `DB: ${numbersError.message}` };
  }

  const activeNumbers = numbers ?? [];
  console.log(`${tag} Números activos en DB: [${activeNumbers.map((n) => n.phone).join(", ")}]`);

  if (activeNumbers.length === 0) {
    console.error(`${tag} No hay números activos en whatsapp_numbers`);
    return { sent: false, mode: "WAWEB", error: "No active numbers" };
  }

  // 4. Rotación circular
  const { data: indexSetting } = await admin
    .from("settings")
    .select("value")
    .eq("key", "whatsapp_rotation_index")
    .single();

  const lastIndex  = parseInt(indexSetting?.value ?? "-1", 10);
  const nextIndex  = (lastIndex + 1) % activeNumbers.length;
  const fromNumber = activeNumbers[nextIndex];

  console.log(`${tag} Rotación: lastIndex=${lastIndex} → nextIndex=${nextIndex} → from=${fromNumber.phone}`);

  await admin
    .from("settings")
    .upsert({ key: "whatsapp_rotation_index", value: String(nextIndex) }, { onConflict: "key" });

  // 5. Llamar al servicio WAWEB
  console.log(`${tag} POST ${serviceUrl}/api/send  from=${fromNumber.phone}`);

  let res: Response;
  try {
    res = await fetch(`${serviceUrl}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromNumber.phone, to, message }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ✗ fetch falló (timeout / red):`, msg);
    return { sent: false, mode: "WAWEB", error: msg };
  }

  const responseBody = await res.text();
  console.log(`${tag} Respuesta del servicio: HTTP ${res.status} — ${responseBody}`);

  if (!res.ok) {
    // HTTP 403 = "número no conectado en el servicio" (no es ban de WhatsApp).
    // No marcar como inactivo en DB — el número puede reconectarse.
    if (res.status === 403) {
      console.warn(
        `${tag} ✗ ${fromNumber.phone} no está CONNECTED en el servicio WAWEB.`,
        `Estado reportado: ${responseBody}`
      );
    } else {
      console.error(`${tag} ✗ HTTP ${res.status} desde el servicio:`, responseBody);
    }
    return { sent: false, mode: "WAWEB", error: `HTTP ${res.status}: ${responseBody}` };
  }

  console.log(`${tag} ✓ Enviado`);
  return { sent: true, mode: "WAWEB" };
}

async function sendViaCloudAPI(to: string, message: string, tag: string): Promise<SendResult> {
  const token         = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`${tag} Cloud API sin credenciales — modo LOG`);
    console.log(`${tag} Mensaje que se enviaría:\n${message}`);
    return { sent: true, mode: "CLOUD_API" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: `52${to}`,
          type: "text",
          text: { body: message },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    const responseBody = await res.text();
    console.log(`${tag} Cloud API HTTP ${res.status} — ${responseBody}`);

    if (!res.ok) return { sent: false, mode: "CLOUD_API", error: responseBody };
    return { sent: true, mode: "CLOUD_API" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ✗ Cloud API excepción:`, msg);
    return { sent: false, mode: "CLOUD_API", error: msg };
  }
}
