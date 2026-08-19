import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushNotification } from "@/lib/push/send";
import { formatCSTDate, formatCSTTime } from "@/lib/appointments/availability";
import type { TemplateKey } from "@/lib/whatsapp/templates";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const admin = createAdminClient();
  const { data: appt } = await admin
    .from("appointments")
    .select("id, branch_id, service_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!appt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(appt);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    starts_at?: string;
    ends_at?: string;
  };

  const { starts_at, ends_at } = body;
  if (!starts_at || !ends_at) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  const roles = (profile?.roles ?? []) as string[];
  const isMaster = roles.includes("MASTER") || roles.includes("ASISTENTE") || roles.includes("TERAPEUTA");
  const isPatient = roles.includes("PACIENTE");

  if (!isMaster && !isPatient) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: appt } = await admin
    .from("appointments")
    .select(`
      id, status, branch_id, patient_id, starts_at, ends_at,
      profiles!patient_id(name),
      branches(name),
      therapists:profiles!therapist_id(id, name)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!appt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (isPatient && !isMaster && appt.patient_id !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (["CANCELADA", "NO_ASISTIO", "COMPLETADA"].includes(appt.status)) {
    return NextResponse.json(
      { error: "INVALID_STATUS", message: "No se puede reagendar una cita cancelada o completada" },
      { status: 422 }
    );
  }

  const { data: branch } = await admin
    .from("branches")
    .select("simultaneous_capacity")
    .eq("id", appt.branch_id)
    .single();

  if (!branch) return NextResponse.json({ error: "BRANCH_NOT_FOUND" }, { status: 404 });

  let slot = new Date(starts_at);
  const endTime = new Date(ends_at);

  while (slot < endTime) {
    const slotEnd = new Date(slot.getTime() + 30 * 60_000);
    const { count } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", appt.branch_id)
      .is("deleted_at", null)
      .not("status", "in", '("CANCELADA","NO_ASISTIO")')
      .neq("id", id)
      .lt("starts_at", slotEnd.toISOString())
      .gt("ends_at", slot.toISOString());

    if ((count ?? 0) >= branch.simultaneous_capacity) {
      return NextResponse.json(
        { error: "SLOT_TAKEN", message: "Ese horario ya no está disponible. Elige otro." },
        { status: 409 }
      );
    }
    slot = slotEnd;
  }

  const { error: updateErr } = await admin
    .from("appointments")
    .update({ starts_at, ends_at, status: "PENDIENTE" })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "DB_ERROR", message: updateErr.message }, { status: 500 });
  }

  // Notificar a todos que la cita fue reagendada
  const patient   = Array.isArray(appt.profiles)   ? appt.profiles[0]   : appt.profiles   as { name: string } | null;
  const branchData = Array.isArray(appt.branches)  ? appt.branches[0]   : appt.branches   as { name: string } | null;
  const therapist = Array.isArray(appt.therapists) ? appt.therapists[0] : appt.therapists as { id: string; name: string } | null;

  const vars = {
    patient_name: patient?.name ?? "",
    date: formatCSTDate(starts_at),
    time: formatCSTTime(starts_at),
    branch_name: branchData?.name ?? "",
  };

  // Obtener Master y Asistente
  const { data: staffProfiles } = await admin
    .from("profiles")
    .select("id")
    .overlaps("roles", ["MASTER", "ASISTENTE"])
    .is("deleted_at", null);

  const staffIds = (staffProfiles ?? []).map((p) => p.id);
  const targets = [...new Set([appt.patient_id, ...staffIds, therapist?.id].filter(Boolean) as string[])];

  await Promise.all(
    targets.map((userId) =>
      sendPushNotification(userId, "appointment_booked" as TemplateKey, vars)
    )
  );

  return NextResponse.json({ id, starts_at, ends_at, status: "PENDIENTE" });
}