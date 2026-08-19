import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

export async function POST(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { branch_id, service_id, price, simultaneous_capacity } = body;

  if (!branch_id || !service_id || price === undefined) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "branch_id, service_id y price son obligatorios" },
      { status: 400 }
    );
  }

  const numPrice = Number(price);
  if (isNaN(numPrice) || numPrice < 0) {
    return NextResponse.json(
      { error: "INVALID_PRICE", message: "El precio debe ser un nÃºmero positivo" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("branch_services")
    .upsert(
      { branch_id: String(branch_id), service_id: String(service_id), price: numPrice, simultaneous_capacity: Number(simultaneous_capacity) || 1 },
      { onConflict: "branch_id,service_id" }
    )
    .select("branch_id, service_id, price")
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const branch_id = searchParams.get("branch_id");
  const service_id = searchParams.get("service_id");

  if (!branch_id || !service_id) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dbErr } = await admin
    .from("branch_services")
    .delete()
    .eq("branch_id", branch_id)
    .eq("service_id", service_id);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}


