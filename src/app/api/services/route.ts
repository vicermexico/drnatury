import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("services")
    .select(`
      id, name, duration_minutes, is_active,
      branch_services(branch_id, price, branches(id, name))
    `)
    .is("deleted_at", null)
    .order("name");

  if (dbErr) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`services:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { name, duration_minutes, simultaneous_capacity } = body;

  if (!name || !duration_minutes) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Nombre y duraciÃ³n son obligatorios" },
      { status: 400 }
    );
  }

  const duration = Number(duration_minutes);
  if (!Number.isInteger(duration) || duration < 30 || duration % 30 !== 0) {
    return NextResponse.json(
      { error: "INVALID_DURATION", message: "La duraciÃ³n debe ser mÃºltiplo de 30 min" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("services")
    .insert({ name: String(name).trim(), duration_minutes: duration, simultaneous_capacity: Number(simultaneous_capacity) || 1 })
    .select("id, name, duration_minutes")
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}


