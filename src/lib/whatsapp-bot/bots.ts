import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// Fase 1 del bot de venta de productos (pedido de Vic, 2026-11-24): en
// vez de un solo Asistente de WhatsApp, ahora puede haber varios --
// cada uno con sus propios mensajes de bienvenida, anuncios,
// correcciones enseñadas y ubicaciones, totalmente independientes
// entre si (ver tabla whatsapp_bots y migracion
// whatsapp_bots_fase1). Por ahora son dos: "consultas" (el que ya
// existia, para agendar citas) y "pomada" (nuevo, para vender la
// Pomada Barak Flex) -- el slug de cada uno es fijo en el codigo (se
// usa para armar las rutas del panel y los links publicos), pero el
// NOMBRE que ve Master en los botones si se puede editar (columna
// "nombre" en whatsapp_bots).
export const BOT_SLUGS = ["consultas", "pomada"] as const;
export type BotSlug = (typeof BOT_SLUGS)[number];

export function esBotSlugValido(valor: unknown): valor is BotSlug {
  return typeof valor === "string" && (BOT_SLUGS as readonly string[]).includes(valor);
}

// Que bots venden un producto de verdad (con entrega a domicilio,
// choferes y rutas -- ver Fase 2/3) y cuales nada mas agendan citas de
// consultorio. Por ahora solo la pomada vende algo; "consultas" no
// necesita ni le aparecen los botones de "Choferes"/"Rutas" en su menu.
const BOTS_CON_PRODUCTOS: readonly BotSlug[] = ["pomada"];

export function botVendeProductos(slug: BotSlug): boolean {
  return BOTS_CON_PRODUCTOS.includes(slug);
}

// A que link publico manda cada bot (ver /chat y /barak-flex) -- se usa
// por ejemplo para armar el link de "Mandar por WhatsApp" en la
// revision de una conversacion, segun de que bot haya sido.
export const BOT_LINK_PUBLICO: Record<BotSlug, string> = {
  consultas: "https://www.drnatury.com/chat",
  pomada: "https://www.drnatury.com/barak-flex",
};

export async function obtenerBotIdPorSlug(
  admin: ReturnType<typeof createAdminClient>,
  slug: string
): Promise<string | null> {
  const slugValido = esBotSlugValido(slug) ? slug : "consultas";
  const { data } = await admin.from("whatsapp_bots").select("id").eq("slug", slugValido).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
