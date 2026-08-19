const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const admin = createClient(url, key);

async function run() {
  // Forzar el tipo correcto como texto
  const { data, error } = await admin.rpc("record_inventory_movement", {
    p_product_id: "4e497dfc-a8e1-4907-948e-d0096b736055",
    p_type: "ENTRADA_PROVEEDOR",
    p_delta: 50,
    p_performed_by: "1740b0d6-9eaa-414e-8f50-98ef6b6e8124",
    p_notes: "TEST entrada",
    p_dest_branch_id: null,
    p_is_warehouse: true,
    p_location_branch: null,
    p_patient_phone: null,
  });
  console.log("Error:", error?.message);
  console.log("Resultado:", data);
}

run();
