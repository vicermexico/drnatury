import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizar } from "@/lib/whatsapp-bot/engine";

// Administra las ubicaciones (pines de GPS) que Master guarda parado
// en cada consultorio -- ver /master/asistente-whatsapp/ubicaciones.
// El Asistente de WhatsApp las usa para mandar el link exacto de
// Google Maps cuando un paciente pide "la ubicación"/"la dirección"
// de algún lugar.
export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("whatsapp_bot_ubicaciones")
    .select("id, nombre, lat, lng, updated_at")
    .order("nombre");

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ubicaciones: data ?? [] });
}

// Guarda (o actualiza, si ya existia una con el mismo nombre) la
// ubicacion de un lugar -- se llama justo despues de capturar el GPS
// del celular de Master parado ahi mismo (ver UbicacionesManager.tsx).
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-ubicaciones:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { nombre?: string; lat?: number; lng?: number };
  const nombre = (body.nombre ?? "").trim();
  const lat = typeof body.lat === "number" ? body.lat : NaN;
  const lng = typeof body.lng === "number" ? body.lng : NaN;
  if (!nombre || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el nombre o la ubicación" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dbErr } = await admin
    .from("whatsapp_bot_ubicaciones")
    .upsert(
      {
        nombre,
        nombre_normalizado: normalizar(nombre),
        lat,
        lng,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "nombre_normalizado" }
    );

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-ubicaciones-borrar:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { id?: string };
  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dbErr } = await admin.from("whatsapp_bot_ubicaciones").delete().eq("id", id);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
