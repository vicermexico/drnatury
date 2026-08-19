const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const admin = createClient(url, key);

async function mov(product_id, type, delta, performed_by, notes, dest_branch_id, is_warehouse, location_branch, patient_phone) {
  const { data, error } = await admin.rpc("run_inventory", {
    p_product_id: product_id,
    p_type: type,
    p_delta: delta,
    p_performed_by: performed_by,
    p_notes: notes,
    p_dest_branch_id: dest_branch_id,
    p_is_warehouse: is_warehouse,
    p_location_branch: location_branch,
    p_patient_phone: patient_phone,
  });
  if (error) console.log("ERROR:", error.message);
  return data;
}

async function run() {
  const PRODUCT = "4e497dfc-a8e1-4907-948e-d0096b736055";
  const ALM     = "1740b0d6-9eaa-414e-8f50-98ef6b6e8124";
  const TER     = "5ff2a098-fa92-4a7c-a02e-e1deeec13dd9";
  const BRANCH  = "71f1d638-2ced-4a27-be5e-3e502ad60c70";

  const { data: pacientes } = await admin.from("profiles")
    .select("id, name, phone").ilike("name", "TEST Paciente%");

  console.log("--- PASO 1: Entrada proveedor +50 ---");
  const r1 = await mov(PRODUCT, "ENTRADA_PROVEEDOR", 50, ALM, "TEST entrada proveedor", null, true, null, null);
  console.log("Resultado:", r1);

  console.log("\n--- PASO 2: Surtido a sucursal -20 ---");
  const r2 = await mov(PRODUCT, "SURTIDO_ALMACEN", -20, ALM, "TEST surtido Guadalupe", BRANCH, true, null, null);
  console.log("Resultado:", r2);

  console.log("\n--- PASO 3: Ventas a 5 pacientes (-2 c/u) ---");
  for (const pac of pacientes) {
    const r3 = await mov(PRODUCT, "VENTA", -2, TER, `TEST venta a ${pac.name}`, null, false, BRANCH, pac.phone);
    console.log(pac.name, "->", r3);
  }

  console.log("\n--- STOCK FINAL ---");
  const { data: items } = await admin.from("inventory_items")
    .select("quantity, is_warehouse, branch_id").eq("product_id", PRODUCT);
  for (const item of items) {
    console.log(item.is_warehouse ? "Almacen central" : `Sucursal ${item.branch_id}`, ":", item.quantity);
  }

  console.log("\n--- MOVIMIENTOS REGISTRADOS ---");
  const { data: movs } = await admin.from("inventory_movements")
    .select("type, quantity_before, quantity_after, notes")
    .eq("product_id", PRODUCT).order("performed_at");
  for (const m of movs) {
    console.log(m.type, m.quantity_before, "->", m.quantity_after, "|", m.notes);
  }
}

run();
