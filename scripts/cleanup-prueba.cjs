const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const admin = createClient(url, key);

async function run() {
  const { error: e1 } = await admin.from("inventory_movements")
    .delete().like("notes", "TEST%");
  console.log("Movimientos TEST borrados:", e1?.message ?? "OK");

  const { error: e2 } = await admin.from("inventory_items")
    .update({ quantity: 0 }).neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Stock en 0:", e2?.message ?? "OK");

  const { data: perfiles } = await admin.from("profiles")
    .select("id").ilike("name", "TEST%");
  const ids = perfiles?.map(p => p.id) ?? [];
  console.log("Perfiles TEST encontrados:", ids.length);

  if (ids.length > 0) {
    const { error: e3 } = await admin.from("profiles").delete().in("id", ids);
    console.log("Perfiles TEST borrados:", e3?.message ?? "OK");
  }

  console.log("Limpieza completa!");
}

run();
