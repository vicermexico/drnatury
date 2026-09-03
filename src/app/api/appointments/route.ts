import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateConfirmToken, buildConfirmUrl } from "@/lib/appointments/tokens";
import { sendPushNotification } from "@/lib/push/send";
import { formatCSTDate, formatCSTTime } from "@/lib/appointments/availability";
import { checkRateLimit } from "@/lib/rate-limit";
import type { TemplateKey } from "@/lib/whatsapp/templates";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branch_id");
  const date = searchParams.get("date");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const admin = createAdminClient();

  const dayStart = date
    ? new Date(`${date}T06:00:00Z`).toISOString()
    : new Date(new Date().setUTCHours(6, 0, 0, 0)).toISOString();

  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dayEnd = nextDay.toISOString();

  let query = admin
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status, created_at,
      profiles!patient_id(id, name, phone),
      services(id, name, duration_minutes),
      branches(id, name),
      therapists:profiles!therapist_id(id, name)
    `)
    .is("deleted_at", null)
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd)
    .order("starts_at");

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  try {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`appointments:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, string>;
  const { branch_id, service_id, starts_at, ends_at, patient_id, notes, therapist_id, modalidad, domicilio_direccion } = body;

  if (!branch_id || !service_id || !starts_at || !ends_at) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "branch_id, service_id, starts_at y ends_at son obligatorios" },
      { status: 400 }
    );
  }

  const effectivePatientId = patient_id ?? user.id;
  const admin = createAdminClient();

  const { data: result, error: rpcError } = await admin.rpc("book_appointment", {
    p_patient_id: effectivePatientId,
    p_branch_id: branch_id,
    p_service_id: service_id,
    p_starts_at: starts_at,
    p_ends_at: ends_at,
    p_created_by: user.id,
    p_therapist_id: therapist_id ?? null,
    p_notes: notes ?? null,
    p_modalidad: modalidad === "DOMICILIO" ? "DOMICILIO" : "CONSULTORIO",
    p_domicilio_direccion: modalidad === "DOMICILIO" ? (domicilio_direccion ?? null) : null,
  });

  if (rpcError) {
    return NextResponse.json({ error: "DB_ERROR", message: rpcError.message }, { status: 500 });
  }

  const bookingResult = result as { error?: string; id?: string; therapist_id?: string };

  if (bookingResult.error === "SLOT_TAKEN") {
    return NextResponse.json(
      { error: "SLOT_TAKEN", message: "Este horario acaba de ser tomado. Elige otro." },
      { status: 409 }
    );
  }
  if (bookingResult.error) {
    return NextResponse.json(
      { error: bookingResult.error, message: `Fallo al agendar: ${bookingResult.error}` },
      { status: 400 }
    );
  }

  const appointmentId = bookingResult.id!;

  const { data: apptData } = await admin
    .from("appointments")
    .select(`
      starts_at, ends_at,
      profiles!patient_id(name, phone),
      services(name),
      branches(name, address),
      therapists:profiles!therapist_id(name)
    `)
    .eq("id", appointmentId)
    .single();

  if (apptData) {
    const patient = Array.isArray(apptData.profiles) ? apptData.profiles[0] : apptData.profiles as { name: string; phone: string } | null;
    const branch = Array.isArray(apptData.branches) ? apptData.branches[0] : apptData.branches as { name: string; address: string } | null;
    const therapist = Array.isArray(apptData.therapists) ? apptData.therapists[0] : apptData.therapists as { name: string } | null;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const confirmUrl = buildConfirmUrl(appointmentId, baseUrl);

    // Notificacion push al paciente (no debe romper la creacion de la cita si falla)
    try {
      await sendPushNotification(effectivePatientId, "appointment_booked", {
        patient_name: patient?.name ?? "",
        branch_name: branch?.name ?? "",
        date: formatCSTDate(apptData.starts_at as string),
        time: formatCSTTime(apptData.starts_at as string),
        therapist_name: therapist?.name ?? "",
        address: branch?.address ?? "",
        confirm_url: confirmUrl,
      });
    } catch (pushErr) {
      console.error("Error enviando push notification:", pushErr);
    }
  }

  return NextResponse.json(
    { id: appointmentId, message: "Cita agendada." },
    { status: 201 }
  );
  } catch (err) {
    console.error("Error en POST /api/appointments:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}




