const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const admin = createClient(url, key);

async function run() {
  // Borrar funciones con tipo enum usando SQL directo
  const { error } = await admin.rpc("exec_sql", {
    sql: "DROP FUNCTION IF EXISTS record_inventory_movement(uuid, inventory_movement_type, integer, uuid, text, uuid, boolean, uuid, text);"
  });
  console.log("Error:", error?.message ?? "OK");
}

run();
