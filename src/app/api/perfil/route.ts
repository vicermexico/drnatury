import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerProfile } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const profile = await getServerProfile();
  if (!profile) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const body = await req.json() as { name?: string; phone?: string; city?: string };
  const { name, phone, city } = body;

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ name, phone, city })
    .eq("id", profile.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}