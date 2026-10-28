import { NextRequest, NextResponse } from "next/server";
import { guardRole } from "@/lib/auth/api-guard";
import { exchangeCodeForTokens, saveConnection } from "@/lib/calendar/google-auth";

export async function GET(request: NextRequest) {
  const { error, userId } = await guardRole("MASTER");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get("gcal_oauth_state")?.value;
  const googleError = searchParams.get("error");

  const redirectBase = "/master/calendario";

  if (googleError) {
    return NextResponse.redirect(new URL(`${redirectBase}?error=cancelado`, request.url));
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL(`${redirectBase}?error=invalido`, request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Esto pasa si Master ya habia conectado antes y Google no mando
      // un refresh_token nuevo. Con prompt=consent en /connect casi
      // nunca deberia pasar, pero por si acaso se avisa claro.
      return NextResponse.redirect(new URL(`${redirectBase}?error=sin_refresh_token`, request.url));
    }
    await saveConnection(tokens.refresh_token, tokens.access_token, tokens.expires_in, userId!);
    const res = NextResponse.redirect(new URL(`${redirectBase}?conectado=1`, request.url));
    res.cookies.delete("gcal_oauth_state");
    return res;
  } catch (err) {
    console.error("Error en callback de Google Calendar:", err);
    return NextResponse.redirect(new URL(`${redirectBase}?error=fallo`, request.url));
  }
}
