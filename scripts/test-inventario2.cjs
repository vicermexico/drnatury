const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const admin = createClient(url, key);

async function rpc(product_id, type, delta, performed_by, notes, dest_branch_id, is_warehouse, location_branch, patient_phone) {
  // Llamar directamente con fetch para evitar ambiguedad de tipos
  const res = await fetch(`${url}/rest/v1/rpc/record_inventory_movement`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Prefer": "params=single-object"
    },
    body: JSON.stringify({
      p_product_id: product_id,
      p_type: type,
      p_delta: delta,
      p_performed_by: performed_by,
      p_notes: notes,
      p_dest_branch_id: dest_branch_id,
      p_is_warehouse: is_warehouse,
      p_location_branch: location_branch,
      p_patient_phone: patient_phone,
    })
  });
  const data = await res.json();
  return { data, ok: res.ok, status: res.status };
}

async function run() {
  const PRODUCT = "4e497dfc-a8e1-4907-948e-d0096b736055";
  const ALM     = "1740b0d6-9eaa-414e-8f50-98ef6b6e8124";
  const TER     = "5ff2a098-fa92-4a7c-a02e-e1deeec13dd9";
  const BRANCH  = "71f1d638-2ced-4a27-be5e-3e502ad60c70";

  const { data: pacientes } = await admin.from("profiles")
    .select("id, name, phone").ilike("name", "TEST Paciente%");

  console.log("--- PASO 1: Entrada proveedor +50 ---");
  const r1 = await rpc(PRODUCT, "ENTRADA_PROVEEDOR", 50, ALM, "TEST entrada proveedor", null, true, null, null);
  console.log(r1.status, r1.data);

  console.log("\n--- PASO 2: Surtido a sucursal -20 ---");
  const r2 = await rpc(PRODUCT, "SURTIDO_ALMACEN", -20, ALM, "TEST surtido Guadalupe", BRANCH, true, null, null);
  console.log(r2.status, r2.data);

  console.log("\n--- PASO 3: Ventas a pacientes ---");
  for (const pac of pacientes) {
    const r3 = await rpc(PRODUCT, "VENTA", -2, TER, `TEST venta a ${pac.name}`, null, false, BRANCH, pac.phone);
    console.log(pac.name, "->", r3.status, r3.data);
  }

  console.log("\n--- STOCK FINAL ---");
  const { data: items } = await admin.from("inventory_items")
    .select("quantity, is_warehouse, branch_id").eq("product_id", PRODUCT);
  for (const item of items) {
    console.log(item.is_warehouse ? "Almacen" : `Sucursal ${item.branch_id}`, ":", item.quantity);
  }

  console.log("\n--- MOVIMIENTOS ---");
  const { data: movs } = await admin.from("inventory_movements")
    .select("type, quantity_before, quantity_after, notes")
    .eq("product_id", PRODUCT).order("performed_at");
  for (const m of movs) {
    console.log(m.type, m.quantity_before, "->", m.quantity_after, "|", m.notes);
  }
}

run();
