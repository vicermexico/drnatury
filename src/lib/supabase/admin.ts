import "server-only";
import { createClient } from "@supabase/supabase-js";

// Admin client con service role key — SOLO para operaciones server-side.
// NUNCA importar en componentes cliente (CLAUDE.md regla 3).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
