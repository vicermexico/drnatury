import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { token?: string };
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("profiles")
    .update({ push_token: token })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}