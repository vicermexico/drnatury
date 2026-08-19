import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyConfirmToken } from "@/lib/appointments/tokens";
import { sendPushNotification } from "@/lib/push/send";
import { formatCSTDate, formatCSTTime } from "@/lib/appointments/availability";
import type { AppointmentStatus } from "@/types";
import type { TemplateKey } from "@/lib/whatsapp/templates";

const ALLOWED_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  PENDIENTE: ["CONFIRMADA", "CANCELADA"],
  CONFIRMADA: ["CANCELADA", "NO_ASISTIO", "COMPLETADA"],
};

async function getStaffIds(admin: ReturnType<typeof createAdminClient>) {
  // Obtener IDs de Master, Asistente
  const { data } = await admin
    .from("profiles")
    .select("id")
    .overlaps("roles", ["MASTER", "ASISTENTE"])
    .is("deleted_at", null);
  return (data ?? []).map((p) => p.id);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    status?: AppointmentStatus;
    confirm_token?: string;
  };

  const { status: newStatus, confirm_token } = body;
  if (!newStatus) return NextResponse.json({ error: "MISSING_STATUS" }, { status: 400 });

  const admin = createAdminClient();

  const { data: appt } = await admin
    .from("appointments")
    .select(`
      id, status, patient_id, branch_id, starts_at, ends_at,
      profiles!patient_id(name, phone),
      services(name),
      branches(name, address),
      therapists:profiles!therapist_id(id, name, phone)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!appt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let authorized = false;

  if (confirm_token) {
    authorized =
      verifyConfirmToken(id, confirm_token) &&
      ["CONFIRMADA", "CANCELADA"].includes(newStatus);
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await admin
        .from("profiles")
        .select("roles")
        .eq("id", user.id)
        .single();
      const roles = (profile?.roles ?? []) as string[];
      authorized =
        roles.includes("MASTER") ||
        roles.includes("ASISTENTE") ||
        (roles.includes("TERAPEUTA") && appt.patient_id !== user.id) ||
        (roles.includes("PACIENTE") && appt.patient_id === user.id);
    }
  }

  if (!authorized) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const currentStatus = appt.status as AppointmentStatus;
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed?.includes(newStatus)) {
    return NextResponse.json(
      { error: "INVALID_TRANSITION", message: `No se puede cambiar de ${currentStatus} a ${newStatus}` },
      { status: 422 }
    );
  }

  const { error: updateError } = await admin
    .from("appointments")
    .update({ status: newStatus })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });

  const patient   = Array.isArray(appt.profiles)   ? appt.profiles[0]   : appt.profiles   as { name: string; phone: string } | null;
  const branch    = Array.isArray(appt.branches)   ? appt.branches[0]   : appt.branches   as { name: string; address: string } | null;
  const therapist = Array.isArray(appt.therapists) ? appt.therapists[0] : appt.therapists as { id: string; name: string; phone: string } | null;

  const dateStr = formatCSTDate(appt.starts_at as string);
  const timeStr = formatCSTTime(appt.starts_at as string);

  const vars = {
    patient_name: patient?.name ?? "",
    date: dateStr,
    time: timeStr,
    branch_name: branch?.name ?? "",
    app_url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };

  const staffIds = await getStaffIds(admin);

  if (newStatus === "CONFIRMADA") {
    // Notificar a Master, Asistente y Terapeuta
    const targets = [...new Set([...staffIds, therapist?.id].filter(Boolean) as string[])];
    await Promise.all(
      targets.map((userId) =>
        sendPushNotification(userId, "appointment_confirmed_notify" as TemplateKey, vars)
      )
    );
  }

  if (newStatus === "CANCELADA") {
    // Notificar a Paciente, Master, Asistente y Terapeuta
    const targets = [...new Set([appt.patient_id, ...staffIds, therapist?.id].filter(Boolean) as string[])];
    await Promise.all(
      targets.map((userId) =>
        sendPushNotification(userId, "appointment_cancelled" as TemplateKey, vars)
      )
    );
  }

  return NextResponse.json({ status: newStatus });
  } catch (err) {
    console.error("Error en PATCH /api/appointments/[id]/status:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

