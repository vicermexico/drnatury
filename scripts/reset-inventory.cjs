const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const admin = createClient(url, key);

async function run() {
  const { error: e1 } = await admin.from("inventory_movements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Movimientos borrados:", e1 ? e1.message : "OK");

  const { error: e2 } = await admin.from("inventory_items").update({ quantity: 0 }).neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Cantidades en 0:", e2 ? e2.message : "OK");
}

run();
