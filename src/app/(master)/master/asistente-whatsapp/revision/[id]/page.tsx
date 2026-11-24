import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { RevisionConversacion } from "./RevisionConversacion";
import { BOT_LINK_PUBLICO, type BotSlug } from "@/lib/whatsapp-bot/bots";

export default async function RevisionConversacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: mensajes } = await admin
    .from("chat_messages")
    .select("id, rol, texto, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

  if (!mensajes || mensajes.length === 0) {
    notFound();
  }

  // Se trae tambien a que bot pertenece esta conversacion (ver Fase 1
  // del bot de venta de productos) -- para armar el link de regreso
  // correcto (/chat o /barak-plus, segun de cual haya sido) y para que
  // "← Revisar mensajes no cerrados" regrese a la lista del bot
  // correcto. Si el visitante dejo su celular durante la platica (ver
  // estado.celular en engine.ts) pero no activo su propia notificacion,
  // aqui se arma el link de WhatsApp para que Master se lo mande a
  // mano, con el link de regreso a esta misma conversacion.
  const { data: lead } = await admin
    .from("chat_leads")
    .select("estado, whatsapp_bots(slug)")
    .eq("id", id)
    .maybeSingle();
  const estado = lead?.estado as { celular?: string } | null;
  const botRelacionado = lead?.whatsapp_bots as { slug: string } | { slug: string }[] | null;
  const botSlug = ((Array.isArray(botRelacionado) ? botRelacionado[0]?.slug : botRelacionado?.slug) ?? "consultas") as BotSlug;
  const linkPublico = BOT_LINK_PUBLICO[botSlug] ?? BOT_LINK_PUBLICO.consultas;
  const celularDigits = estado?.celular?.replace(/\D/g, "");
  const linkWhatsapp = celularDigits
    ? `https://wa.me/52${celularDigits}?text=${encodeURIComponent(
        `Hola, vi que se quedó a medias agendando su cita 😊 Puede continuar donde se quedó aquí: ${linkPublico}?retomar=${id}`
      )}`
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/master/asistente-whatsapp/revision?bot=${botSlug}`} className="text-sm text-blue-600 hover:underline">
          ← Revisar mensajes no cerrados
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Conversación</h1>
        <p className="text-sm text-gray-500 mt-1">
          Dale clic a la respuesta del bot donde se equivocó para enseñarle qué debió haber contestado.
        </p>
      </div>

      {linkWhatsapp && (
        <a
          href={linkWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600"
        >
          📲 Mandar por WhatsApp (traerlo de vuelta a esta conversación)
        </a>
      )}

      <RevisionConversacion
        mensajes={mensajes.map((m) => ({ id: m.id, rol: m.rol as "paciente" | "bot", texto: m.texto }))}
        bot={botSlug}
      />
    </div>
  );
}
