import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerProfile } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const profile = await getServerProfile();
  if (!profile) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const body = await req.json() as {
    title: string;
    description?: string;
    image_url?: string;
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from("landing_services")
    .insert({
      title: body.title,
      description: body.description ?? "",
      image_url: body.image_url ?? "",
      order_index: 0,
    });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}