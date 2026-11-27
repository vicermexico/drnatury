import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Antes el tiempo extra que se bloquea en una cita a domicilio (traslado
// e instalacion) era un numero fijo (90 minutos) repetido en 4 archivos
// distintos del codigo, sin ninguna forma de cambiarlo desde la pagina.
// Ahora vive en la tabla `domicilio_config` (una sola fila) para que Vic
// lo pueda ajustar el mismo desde /master/servicios-domicilio.
//
// Si por alguna razon la tabla no responde (fila borrada, etc.) se usa
// 90 como respaldo para no romper el agendado.
const DEFAULT_EXTRA_MINUTES = 90;

export async function getDomicilioExtraMinutes(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("domicilio_config")
    .select("extra_minutes")
    .eq("id", true)
    .maybeSingle();
  return data?.extra_minutes ?? DEFAULT_EXTRA_MINUTES;
}

export async function setDomicilioExtraMinutes(minutos: number): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("domicilio_config")
    .upsert({ id: true, extra_minutes: minutos, updated_at: new Date().toISOString() }, { onConflict: "id" });
}
