import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Maneja la conexion OAuth de Master con Google Calendar. Solo hay un
// Master, asi que se guarda una sola fila (id fijo) con su refresh_token
// -- con eso se puede pedir un access_token nuevo cada vez que haga
// falta, sin que Master tenga que volver a conectar.

const CONNECTION_ID = "00000000-0000-0000-0000-000000000001";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function getGoogleRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.drnatury.com";
  return `${base.replace(/\/$/, "")}/api/google-calendar/callback`;
}

export function buildGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID not set");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent", // fuerza que siempre regrese un refresh_token, aun si ya se habia conectado antes
    scope: "https://www.googleapis.com/auth/calendar.events",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{ refresh_token?: string; access_token: string; expires_in: number }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET not set");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function saveConnection(refreshToken: string, accessToken: string, expiresInSeconds: number, connectedBy: string): Promise<void> {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  await admin.from("google_calendar_connection").upsert({
    id: CONNECTION_ID,
    refresh_token: refreshToken,
    access_token: accessToken,
    access_token_expires_at: expiresAt,
    connected_by: connectedBy,
    updated_at: new Date().toISOString(),
  });
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const admin = createAdminClient();
  await admin.from("google_calendar_connection").delete().eq("id", CONNECTION_ID);
}

export async function isGoogleCalendarConnected(): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("google_calendar_connection").select("id").eq("id", CONNECTION_ID).maybeSingle();
  return !!data;
}

// Devuelve un access_token valido (lo refresca con el refresh_token si
// ya expiro). Regresa null si no hay conexion guardada o si algo falla.
export async function getValidAccessToken(): Promise<string | null> {
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("google_calendar_connection")
    .select("refresh_token, access_token, access_token_expires_at")
    .eq("id", CONNECTION_ID)
    .maybeSingle();

  if (!conn) return null;

  const expiresAt = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
  const aunValido = conn.access_token && expiresAt - Date.now() > 60_000; // margen de 1 min
  if (aunValido) return conn.access_token;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      console.error("Error refrescando token de Google Calendar:", await res.text());
      return null;
    }
    const data = await res.json() as { access_token: string; expires_in: number };
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    await admin.from("google_calendar_connection").update({
      access_token: data.access_token,
      access_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", CONNECTION_ID);
    return data.access_token;
  } catch (err) {
    console.error("Error refrescando token de Google Calendar:", err);
    return null;
  }
}
