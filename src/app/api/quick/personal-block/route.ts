import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQuickSecret } from "@/lib/quick-link/secret";
import { checkRateLimit } from "@/lib/rate-limit";

// Boton "Personal" del link rapido de Master: bloquea un rango de horas
// en TODAS las sucursales (branch_id = null, igual que "Todas las
// sucursales" en /master/citas/bloquear) para que ningun paciente pueda
// agendar en ese rango. Protegido por el mismo codigo secreto que
// /api/quick/book.

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    if (!checkRateLimit(`quick-block:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const secret = request.headers.get("x-quick-secret");
    if (!verifyQuickSecret(secret)) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, string>;
    const { fecha, desde, hasta, motivo } = body;

    if (!fecha || !desde || !hasta) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "Dia, desde y hasta son obligatorios" },
        { status: 400 }
      );
    }
    if (desde >= hasta) {
      return NextResponse.json({ error: "INVALID_RANGE", message: "La hora de inicio debe ser antes que la de fin" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: master } = await admin
      .from("profiles")
      .select("id")
      .contains("roles", ["MASTER"])
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    const { data, error: dbErr } = await admin
      .from("blocked_slots")
      .insert({
        branch_id: null,
        date: fecha,
        all_day: false,
        start_time: desde,
        end_time: hasta,
        reason: motivo?.trim() || "Bloqueo personal (link rapido)",
        created_by: master?.id ?? null,
      })
      .select()
      .single();

    if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

    return NextResponse.json({ id: data.id, message: "Horario bloqueado." }, { status: 201 });
  } catch (err) {
    console.error("Error en POST /api/quick/personal-block:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
