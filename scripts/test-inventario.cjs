const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const admin = createClient(url, key);

async function run() {
  // Obtener datos de prueba
  const { data: perfiles } = await admin.from("profiles")
    .select("id, name, roles, branch_id")
    .ilike("name", "TEST%");

  const almacenista = perfiles.find(p => p.roles.includes("ALMACENISTA"));
  const terapeuta   = perfiles.find(p => p.roles.includes("TERAPEUTA"));
  const pacientes   = perfiles.filter(p => p.roles.includes("PACIENTE"));
  const branchId    = almacenista.branch_id;

  console.log("Almacenista:", almacenista.name, almacenista.id);
  console.log("Terapeuta:", terapeuta.name, terapeuta.id);
  console.log("Pacientes:", pacientes.map(p => p.name).join(", "));
  console.log("Sucursal:", branchId);

  // Obtener primer producto
  const { data: products } = await admin.from("products").select("id, name").eq("is_active", true).limit(1);
  const product = products[0];
  console.log("\nProducto:", product.name, product.id);

  // PASO 1: Almacenista recibe 50 piezas del proveedor
  console.log("\n--- PASO 1: Entrada de proveedor (+50) ---");
  const { data: r1, error: e1 } = await admin.rpc("record_inventory_movement", {
    p_product_id: product.id,
    p_type: "ENTRADA_PROVEEDOR",
    p_delta: 50,
    p_performed_by: almacenista.id,
    p_notes: "TEST - Entrada de proveedor",
    p_dest_branch_id: null,
    p_is_warehouse: true,
    p_location_branch: null,
    p_patient_phone: null,
  });
  if (e1) { console.log("Error:", e1.message); return; }
  console.log("Resultado:", r1);

  // PASO 2: Almacenista envia 20 piezas a sucursal
  console.log("\n--- PASO 2: Surtido a sucursal (-20 almacen, +20 sucursal) ---");
  const { data: r2, error: e2 } = await admin.rpc("record_inventory_movement", {
    p_product_id: product.id,
    p_type: "SURTIDO_ALMACEN",
    p_delta: -20,
    p_performed_by: almacenista.id,
    p_notes: "TEST - Envio a sucursal Guadalupe",
    p_dest_branch_id: branchId,
    p_is_warehouse: true,
    p_location_branch: null,
    p_patient_phone: null,
  });
  if (e2) { console.log("Error:", e2.message); return; }
  console.log("Resultado:", r2);

  // PASO 3: Terapeuta vende a 5 pacientes (2 piezas cada uno)
  console.log("\n--- PASO 3: Ventas a pacientes ---");
  for (const pac of pacientes) {
    const { data: r3, error: e3 } = await admin.rpc("record_inventory_movement", {
      p_product_id: product.id,
      p_type: "VENTA",
      p_delta: -2,
      p_performed_by: terapeuta.id,
      p_notes: `TEST - Venta a ${pac.name}`,
      p_dest_branch_id: null,
      p_is_warehouse: false,
      p_location_branch: branchId,
      p_patient_phone: "1234567890",
    });
    if (e3) { console.log("Error vendiendo a", pac.name, ":", e3.message); continue; }
    console.log(`Venta a ${pac.name}:`, r3);
  }

  // VERIFICAR STOCK FINAL
  console.log("\n--- STOCK FINAL ---");
  const { data: items } = await admin.from("inventory_items")
    .select("quantity, is_warehouse, branch_id")
    .eq("product_id", product.id);
  for (const item of items) {
    console.log(item.is_warehouse ? "Almacen central" : `Sucursal ${item.branch_id}`, ":", item.quantity);
  }

  // VERIFICAR MOVIMIENTOS
  console.log("\n--- MOVIMIENTOS REGISTRADOS ---");
  const { data: movs } = await admin.from("inventory_movements")
    .select("type, quantity_before, quantity_after, notes")
    .eq("product_id", product.id)
    .order("performed_at");
  for (const m of movs) {
    console.log(m.type, m.quantity_before, "->", m.quantity_after, "|", m.notes);
  }
}

run();
