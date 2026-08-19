import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;
  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("branches")
    .select("id, name, address, is_active, schedule, created_at")
    .is("deleted_at", null)
    .order("name");
  if (dbErr) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`branches:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const { error } = await guardRole("MASTER");
  if (error) return error;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { name, address, street, colonia, municipio, estado, cp, schedule, lat, lng } = body;
  if (!name || !address) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Nombre y direccion son obligatorios" },
      { status: 400 }
    );
  }
  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("branches")
    .insert({
      name: String(name).trim(),
      address: String(address).trim(),
      schedule: schedule ?? {},
      street: street ?? null,
      colonia: colonia ?? null,
      municipio: municipio ?? null,
      estado: estado ?? null,
      cp: cp ?? null,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    })
    .select("id, name")
    .single();
  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
