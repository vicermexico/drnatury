import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cstToUTC } from "./availability";
import { createGoogleCalendarEvent } from "@/lib/calendar/google-events";
import { buildConfirmUrl, buildUbicacionUrl } from "./tokens";
import { ensureGoogleContact } from "@/lib/contacts/google-contacts";

// Registra una cita "rapida" (sin cuenta de paciente de verdad) usando el
// mismo RPC book_appointment() que ya usa el resto de la app -- por lo
// tanto el mismo chequeo de disponibilidad con FOR UPDATE (CLAUDE.md
// regla 4) se aplica igual aqui. Es la misma idea que /api/quick/book
// (agendado rapido de Master desde su link privado), extraida para que
// tambien la pueda usar el chat publico (/chat) cuando alguien termina de
// agendar platicando con el asistente.
//
// El servicio de 30 min "Consulta rapida (link)" y el perfil de MASTER se
// usan como "placeholders" para satisfacer las columnas obligatorias de
// appointments -- el nombre y celular de verdad se guardan en
// quick_name/quick_phone, no en un paciente de verdad todavia.

const QUICK_SERVICE_NAME = "Consulta rapida (link)";
const DOMICILIO_EXTRA_MINUTES = 90;

export interface CitaRapidaInput {
  nombre: string;
  telefonoDigits: string | null;
  fechaISO: string; // "YYYY-MM-DD"
  hora24: string; // "HH:MM" 24 horas
  modalidad: "CONSULTORIO" | "DOMICILIO";
  lugar?: string | null;
  numPersonas: number;
  costoTotal: number | null;
  notas: string;
}

export interface CitaRapidaResultado {
  ok: boolean;
  appointmentId?: string;
  error?: string;
  confirmUrl?: string;
  whatsappUrl?: string | null;
  contactCode?: string | null;
  calendarSynced?: boolean;
}

export async function crearCitaRapida(
  admin: SupabaseClient,
  input: CitaRapidaInput
): Promise<CitaRapidaResultado> {
  const esDomicilio = input.modalidad === "DOMICILIO";

  const [{ data: master }, { data: servicio }] = await Promise.all([
    admin.from("profiles").select("id").contains("roles", ["MASTER"]).is("deleted_at", null).limit(1).maybeSingle(),
    admin.from("services").select("id, duration_minutes").eq("name", QUICK_SERVICE_NAME).maybeSingle(),
  ]);
  if (!master || !servicio) {
    return { ok: false, error: "SETUP_INCOMPLETE" };
  }

  let branchId: string | null = null;
  let therapistId: string | null = null;

  if (!esDomicilio) {
    const { data: branch } = await admin
      .from("branches")
      .select("id")
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!branch) return { ok: false, error: "NOT_FOUND" };
    branchId = branch.id;

    const { data: terapeuta } = await admin
      .from("profiles")
      .select("id")
      .contains("roles", ["TERAPEUTA"])
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    therapistId = terapeuta?.id ?? null;
  } else {
    const { data: terapeuta } = await admin
      .from("profiles")
      .select("id")
      .contains("roles", ["TERAPEUTA"])
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    therapistId = terapeuta?.id ?? null;
    // book_appointment requiere un branch_id incluso para domicilio (es
    // obligatorio en la tabla); se usa la primera sucursal activa solo
    // como referencia administrativa, no como el lugar real de la cita.
    const { data: branch } = await admin.from("branches").select("id").eq("is_active", true).is("deleted_at", null).limit(1).maybeSingle();
    branchId = branch?.id ?? null;
    if (!branchId) return { ok: false, error: "NOT_FOUND" };
  }

  const durationMinutes = (servicio.duration_minutes ?? 30) + (esDomicilio ? DOMICILIO_EXTRA_MINUTES : 0);
  const startsAt = cstToUTC(input.fechaISO, input.hora24);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const { data: result, error: rpcError } = await admin.rpc("book_appointment", {
    p_patient_id: master.id,
    p_branch_id: branchId,
    p_service_id: servicio.id,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_created_by: master.id,
    p_therapist_id: therapistId,
    p_notes: input.notas,
    p_modalidad: esDomicilio ? "DOMICILIO" : "CONSULTORIO",
    p_domicilio_direccion: esDomicilio ? (input.lugar ?? null) : null,
  });

  if (rpcError) {
    return { ok: false, error: rpcError.message };
  }

  const bookingResult = result as { error?: string; id?: string };
  if (bookingResult.error) {
    return { ok: false, error: bookingResult.error };
  }

  const appointmentId = bookingResult.id!;
  await admin
    .from("appointments")
    .update({
      quick_name: input.nombre,
      quick_phone: input.telefonoDigits,
      num_personas: input.numPersonas,
      costo_total: input.costoTotal,
    })
    .eq("id", appointmentId);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.drnatury.com";
  const confirmUrl = buildConfirmUrl(appointmentId, baseUrl);

  // Guarda al paciente en el Directorio de contactos del celular de
  // Master (via Google Contacts), con un codigo "P-####" en vez del
  // nombre real -- best-effort: si no esta conectado o falla, no se
  // rompe el agendado. Se hace ANTES de crear el evento de Calendar
  // para poder usar el mismo codigo en el titulo (igual que /api/quick/book).
  let contactCode: string | null = null;
  if (input.telefonoDigits) {
    const contactResult = await ensureGoogleContact(input.telefonoDigits);
    contactCode = contactResult.code;
  }

  let whatsappUrl: string | null = null;
  if (input.telefonoDigits) {
    const waPhone = input.telefonoDigits.length === 10 ? `52${input.telefonoDigits}` : input.telefonoDigits;
    let waMensaje = `Hola ${input.nombre}, te escribo de DrNatury para confirmar tu cita del ${input.fechaISO} a las ${input.hora24}. ¿Puedes confirmarla?`;
    if (esDomicilio) {
      waMensaje += `\n\nPara llegar sin problema, ¿nos compartes tu ubicación aquí? ${buildUbicacionUrl(appointmentId, baseUrl)}`;
    }
    whatsappUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMensaje)}`;
  }

  // Evento directo en Google Calendar -- tambien best-effort (ver nota de
  // createGoogleCalendarEvent: nunca lanza error hacia arriba).
  const location = esDomicilio ? (input.lugar || "A domicilio") : (input.lugar || "Consultorio");
  const summaryPartes = [String(input.numPersonas)];
  if (input.lugar) summaryPartes.push(input.lugar);
  summaryPartes.push(contactCode ?? input.nombre);
  const summary = summaryPartes.join(" ");

  const descripcionPartes = [`${input.nombre} — ${confirmUrl}`];
  if (input.costoTotal) descripcionPartes.push(`$${input.costoTotal}`);
  const { id: googleEventId } = await createGoogleCalendarEvent({
    summary,
    description: descripcionPartes.join("\n"),
    location,
    startISO: startsAt.toISOString(),
    endISO: endsAt.toISOString(),
    colorId: esDomicilio ? "5" : undefined, // 5 = Banana (amarillo)
  });
  if (googleEventId) {
    await admin.from("appointments").update({ google_event_id: googleEventId }).eq("id", appointmentId);
  }

  return {
    ok: true,
    appointmentId,
    confirmUrl,
    whatsappUrl,
    contactCode,
    calendarSynced: !!googleEventId,
  };
}
