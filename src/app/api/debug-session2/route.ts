import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ step: "getUser", user: null, userError: userError?.message ?? null });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, phone, roles, branch_id, is_active, branches(name)")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    step: "getProfile",
    userId: user.id,
    userEmail: user.email,
    profile,
    profileError: profileError ? { message: profileError.message, code: profileError.code, details: profileError.details, hint: profileError.hint } : null,
  });
}
