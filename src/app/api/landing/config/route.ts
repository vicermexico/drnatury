import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerProfile } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const profile = await getServerProfile();
  if (!profile) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const body = await req.json() as {
    whatsapp_number?: string;
    hero_title?: string;
    hero_subtitle?: string;
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from("landing_config")
    .update(body)
    .not("id", "is", null);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}