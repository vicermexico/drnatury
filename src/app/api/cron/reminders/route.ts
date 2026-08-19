import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushNotification } from "@/lib/push/send";
import { formatCSTDate, formatCSTTime } from "@/lib/appointments/availability";
import type { TemplateKey } from "@/lib/whatsapp/templates";

// Este endpoint se llama cada hora automáticamente
// Busca citas que sean en las próximas 24 horas y manda recordatorio
export async function GET(request: NextRequest) {
  // Verificar que viene de un cron autorizado
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Buscar citas en las próximas 24 horas que no hayan recibido recordatorio
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: appointments, error } = await admin
    .from("appointments")
    .select(`
      id, starts_at, patient_id,
      profiles!patient_id(name),
      branches(name, address),
      therapists:profiles!therapist_id(name)
    `)
    .is("deleted_at", null)
    .in("status", ["PENDIENTE", "CONFIRMADA"])
    .gte("starts_at", now.toISOString())
    .lte("starts_at", in24h.toISOString())
    .eq("reminder_sent", false);

  if (error) {
    console.error("[CRON reminders] Error:", error.message);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  let sent = 0;

  for (const appt of appointments ?? []) {
    const patient  = Array.isArray(appt.profiles)  ? appt.profiles[0]  : appt.profiles  as { name: string } | null;
    const branch   = Array.isArray(appt.branches)  ? appt.branches[0]  : appt.branches  as { name: string; address: string } | null;
    const therapist = Array.isArray(appt.therapists) ? appt.therapists[0] : appt.therapists as { name: string } | null;

    const result = await sendPushNotification(appt.patient_id, "appointment_reminder" as TemplateKey, {
      patient_name: patient?.name ?? "",
      branch_name: branch?.name ?? "",
      date: formatCSTDate(appt.starts_at as string),
      time: formatCSTTime(appt.starts_at as string),
      therapist_name: therapist?.name ?? "",
    });

    if (result.sent) {
      // Marcar que ya se mandó el recordatorio
      await admin
        .from("appointments")
        .update({ reminder_sent: true })
        .eq("id", appt.id);
      sent++;
    }
  }

  console.log(`[CRON reminders] Recordatorios enviados: ${sent}`);
  return NextResponse.json({ sent });
}