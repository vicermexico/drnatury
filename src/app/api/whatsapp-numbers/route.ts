import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("whatsapp_numbers")
    .select("id, phone, is_active, display_order, last_used_at")
    .order("display_order");

  if (dbErr) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { phone?: string };
  const phone = body.phone?.replace(/\D/g, "");

  if (!phone || phone.length < 10) {
    return NextResponse.json(
      { error: "INVALID_PHONE", message: "Ingresa un teléfono válido de 10 dígitos" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Máximo 4 números
  const { count } = await admin
    .from("whatsapp_numbers")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) >= 4) {
    return NextResponse.json(
      { error: "MAX_REACHED", message: "Ya tienes 4 números registrados (máximo permitido)" },
      { status: 409 }
    );
  }

  // No duplicar
  const { data: existing } = await admin
    .from("whatsapp_numbers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "ALREADY_EXISTS", message: "Ese número ya está registrado" },
      { status: 409 }
    );
  }

  // Asignar el siguiente display_order disponible
  const { data: numbers } = await admin
    .from("whatsapp_numbers")
    .select("display_order")
    .order("display_order");

  const usedOrders = new Set((numbers ?? []).map((n) => n.display_order));
  const nextOrder = [0, 1, 2, 3].find((o) => !usedOrders.has(o)) ?? 0;

  const { data, error: dbErr } = await admin
    .from("whatsapp_numbers")
    .insert({ phone, is_active: true, display_order: nextOrder })
    .select("id, phone, is_active, display_order")
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
