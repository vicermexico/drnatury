const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const admin = createClient(url, key);

async function run() {
  const { data, error } = await admin.from("profiles")
    .select("id, name, phone, roles")
    .ilike("name", "TEST%");
  console.log("Error:", error?.message);
  console.log("Perfiles TEST:", JSON.stringify(data, null, 2));
}

run();
