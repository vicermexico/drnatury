import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  const { error } = await guardAnyRole("MASTER", "ASISTENTE");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const branch_id = searchParams.get("branch_id");

  const admin = createAdminClient();
  let query = admin
    .from("blocked_slots")
    .select("id, branch_id, date, all_day, start_time, end_time, reason, created_at")
    .order("date");

  if (date) query = query.eq("date", date);

  const { data, error: dbErr } = await query;
  if (dbErr) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });

  // Filtrar por sucursal o globales
  const filtered = branch_id
    ? (data ?? []).filter(b => b.branch_id === branch_id || b.branch_id === null)
    : (data ?? []);

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const { error, userId } = await guardAnyRole("MASTER", "ASISTENTE");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { branch_id, date, all_day, slots, reason } = body;

  if (!date) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "date es obligatorio" }, { status: 400 });
  }

  const admin = createAdminClient();
  const records = [];

  if (all_day) {
    records.push({
      branch_id: branch_id ?? null,
      date: String(date),
      all_day: true,
      start_time: null,
      end_time: null,
      reason: reason ?? null,
      created_by: userId,
    });
  } else {
    for (const slot of (slots as { start: string; end: string }[] ?? [])) {
      records.push({
        branch_id: branch_id ?? null,
        date: String(date),
        all_day: false,
        start_time: slot.start,
        end_time: slot.end,
        reason: reason ?? null,
        created_by: userId,
      });
    }
  }

  const { data, error: dbErr } = await admin
    .from("blocked_slots")
    .insert(records)
    .select();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { error } = await guardAnyRole("MASTER", "ASISTENTE");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("blocked_slots").delete().eq("id", id);

  return NextResponse.json({ deleted: true });
}
