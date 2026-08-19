import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const cookieNames = request.cookies.getAll().map((c) => c.name);
  let userResult: unknown = null;
  let userError: unknown = null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );
    const { data, error } = await supabase.auth.getUser();
    userResult = data.user ? { id: data.user.id, email: data.user.email } : null;
    userError = error ? error.message : null;
  } catch (e) {
    userError = String(e);
  }
  return NextResponse.json({
    hasEnvUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasEnvKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieNames,
    selectedRoleCookie: request.cookies.get("selected_role")?.value ?? null,
    user: userResult,
    userError,
  });
}
