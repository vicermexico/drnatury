import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQuickSecret } from "@/lib/quick-link/secret";
import { cstToUTC } from "@/lib/appointments/availability";
import { checkRateLimit } from "@/lib/rate-limit";
import { createGoogleCalendarEvent } from "@/lib/calendar/google-events";
import { buildConfirmUrl, buildUbicacionUrl } from "@/lib/appointments/tokens";
import { ensureGoogleContact } from "@/lib/contacts/google-contacts";

// Agendado rapido de Master, sin login — protegido por un codigo secreto
// en el header x-quick-secret (ver src/lib/quick-link/secret.ts). Reusa
// el mismo book_appointment() RPC (y por lo tanto el mismo chequeo de
// disponibilidad con FOR UPDATE) que usa el resto de la app, para que
// "ya esta ocupado" se detecte igual en todos lados.
//
// El servicio de 30 min "Consulta rapida (link)" (ver migracion
// 20261028000001_quick_link_setup.sql) y el perfil de MASTER se usan
// como "placeholders" para satisfacer las columnas obligatorias de
// appointments — el nombre real que escribio Master se guarda en
// quick_name, no en un paciente de verdad.

const QUICK_SERVICE_NAME = "Consulta rapida (link)";
const DOMICILIO_EXTRA_MINUTES = 90;

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    if (!checkRateLimit(`quick-book:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const secret = request.headers.get("x-quick-secret");
    if (!verifyQuickSecret(secret)) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, string>;
    const { nombre, fecha, hora, modalidad, consultorio_lugar, domicilio_direccion, num_personas, costo_total, telefono } = body;

    if (!nombre?.trim() || !fecha || !hora) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "Nombre, dia y hora son obligatorios" },
        { status: 400 }
      );
    }
    const esDomicilio = modalidad === "DOMICILIO";

    const admin = createAdminClient();

    const [{ data: master }, { data: servicio }] = await Promise.all([
      admin.from("profiles").select("id").contains("roles", ["MASTER"]).is("deleted_at", null).limit(1).maybeSingle(),
      admin.from("services").select("id, duration_minutes").eq("name", QUICK_SERVICE_NAME).maybeSingle(),
    ]);

    if (!master || !servicio) {
      return NextResponse.json({ error: "SETUP_INCOMPLETE", message: "Falta configuracion (servicio o Master)" }, { status: 500 });
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
      if (!branch) return NextResponse.json({ error: "NOT_FOUND", message: "No hay sucursal activa" }, { status: 404 });
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
      if (!branchId) return NextResponse.json({ error: "NOT_FOUND", message: "No hay sucursal activa" }, { status: 404 });
    }

    const durationMinutes = (servicio.duration_minutes ?? 30) + (esDomicilio ? DOMICILIO_EXTRA_MINUTES : 0);
    const startsAt = cstToUTC(fecha, hora);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    const { data: result, error: rpcError } = await admin.rpc("book_appointment", {
      p_patient_id: master.id,
      p_branch_id: branchId,
      p_service_id: servicio.id,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_created_by: master.id,
      p_therapist_id: therapistId,
      p_notes: `Agendado rapido (link): ${nombre.trim()}`,
      p_modalidad: esDomicilio ? "DOMICILIO" : "CONSULTORIO",
      p_domicilio_direccion: esDomicilio ? (domicilio_direccion ?? null) : null,
    });

    if (rpcError) {
      return NextResponse.json({ error: "DB_ERROR", message: rpcError.message }, { status: 500 });
    }

    const bookingResult = result as { error?: string; id?: string };
    if (bookingResult.error === "SLOT_TAKEN") {
      return NextResponse.json({ error: "SLOT_TAKEN", message: "No se puede agendar: ese horario ya esta ocupado." }, { status: 409 });
    }
    if (bookingResult.error) {
      return NextResponse.json({ error: bookingResult.error, message: `No se pudo agendar: ${bookingResult.error}` }, { status: 400 });
    }

    const appointmentId = bookingResult.id!;
    const numPersonas = Math.max(1, parseInt(num_personas ?? "1", 10) || 1);
    const costo = costo_total ? Number(costo_total) : null;
    // Telefono del paciente: opcional, solo si Vic lo incluyo en el texto
    // que pego (linea "Telefono"/"Cel"/etc). Se guarda en la cita para que
    // la pagina de la cita (el link que le llega a su calendario) pueda
    // ofrecer el boton de WhatsApp el dia de la consulta.
    const telefonoDigits = (telefono ?? "").replace(/\D/g, "");

    await admin
      .from("appointments")
      .update({
        quick_name: nombre.trim(),
        quick_phone: telefonoDigits || null,
        num_personas: numPersonas,
        costo_total: costo !== null && !Number.isNaN(costo) ? costo : null,
      })
      .eq("id", appointmentId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.drnatury.com";
    const confirmUrl = buildConfirmUrl(appointmentId, baseUrl);

    // Guarda al paciente en el Directorio de contactos del celular de
    // Master (via Google Contacts), con un codigo "P-####" en vez del
    // nombre real -- best-effort: si no esta conectado o falla, no se
    // rompe el agendado. Se hace ANTES de crear el evento de Calendar
    // para poder usar el mismo codigo en el titulo.
    let contactCode: string | null = null;
    let contactError: string | undefined;
    if (telefonoDigits) {
      const contactResult = await ensureGoogleContact(telefonoDigits);
      contactCode = contactResult.code;
      contactError = contactResult.error;
    }

    let whatsappUrl: string | null = null;
    if (telefonoDigits) {
      const waPhone = telefonoDigits.length === 10 ? `52${telefonoDigits}` : telefonoDigits;
      let waMensaje = `Hola ${nombre.trim()}, te escribo de DrNatury para confirmar tu cita del ${fecha} a las ${hora}. ¿Puedes confirmarla?`;
      if (esDomicilio) {
        waMensaje += `\n\nPara llegar sin problema, ¿nos compartes tu ubicación aquí? ${buildUbicacionUrl(appointmentId, baseUrl)}`;
      }
      whatsappUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMensaje)}`;
    }

    // Intenta crear el evento directo en Google Calendar (best-effort --
    // si no esta conectado o algo falla, no se rompe el agendado; el
    // frontend usa calendar_synced/calendar_sync_error para decidir que
    // mostrar). El titulo usa el codigo de contacto (no el nombre real)
    // cuando hay uno: "{personas} {lugar} P-####" -- lugar es el
    // municipio a domicilio o el consultorio/sucursal que Vic escribio
    // despues de "Si" (ej. "San Blas", "Mitras"); a domicilio ademas se
    // pinta de amarillo en Google Calendar.
    const lugar = (esDomicilio ? domicilio_direccion : consultorio_lugar)?.trim() || "";
    const location = esDomicilio ? (domicilio_direccion || "A domicilio") : (lugar || "Consultorio");
    const summaryPartes = [String(numPersonas)];
    if (lugar) summaryPartes.push(lugar);
    summaryPartes.push(contactCode ?? nombre.trim());
    const summary = summaryPartes.join(" ");

    // Nombre y link van juntos en la misma linea ("a lado") -- al abrir
    // ese link el dia de la cita, ahi mismo esta el boton de WhatsApp
    // (si se guardo telefono).
    const descripcionPartes = [`${nombre.trim()} — ${confirmUrl}`];
    if (costo) descripcionPartes.push(`$${costo}`);
    const { id: googleEventId, error: calendarError } = await createGoogleCalendarEvent({
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

    return NextResponse.json({
      id: appointmentId,
      message: "Agendado exitoso.",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      calendar_synced: !!googleEventId,
      calendar_sync_error: googleEventId ? undefined : calendarError,
      confirm_url: confirmUrl,
      whatsapp_url: whatsappUrl,
      contact_code: contactCode,
      contact_sync_error: contactCode ? undefined : contactError,
    }, { status: 201 });
  } catch (err) {
    console.error("Error en POST /api/quick/book:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
