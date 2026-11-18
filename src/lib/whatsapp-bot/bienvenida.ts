import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BienvenidaItem } from "./engine";

// Lee la serie de mensajes de bienvenida que Master armo desde el panel
// (/master/asistente-whatsapp), en el orden que el mismo decidio -- la
// usan tanto el chat publico como el de entrenamiento para mandar el
// saludo inicial.
export async function obtenerSerieBienvenida(admin: SupabaseClient): Promise<BienvenidaItem[]> {
  const { data } = await admin
    .from("whatsapp_bot_bienvenida")
    .select("tipo, texto, audio_url")
    .order("orden", { ascending: true });

  return (data ?? [])
    .map((fila): BienvenidaItem | null => {
      if (fila.tipo === "audio" && fila.audio_url) {
        return { tipo: "audio", contenido: fila.audio_url as string };
      }
      if (fila.tipo === "texto" && fila.texto) {
        return { tipo: "texto", contenido: fila.texto as string };
      }
      return null;
    })
    .filter((item): item is BienvenidaItem => item !== null);
}
