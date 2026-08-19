const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const { randomUUID } = require("crypto");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const admin = createClient(url, key);

async function run() {
  const { data: branches } = await admin.from("branches").select("id, name").eq("is_active", true).limit(1);
  const branch = branches?.[0];
  console.log("Sucursal:", branch.name);

  const perfiles = [
    { id: randomUUID(), name: "TEST Almacenista", phone: "0000000001", roles: ["ALMACENISTA"], branch_id: branch.id },
    { id: randomUUID(), name: "TEST Terapeuta",   phone: "0000000002", roles: ["TERAPEUTA"],   branch_id: branch.id },
    { id: randomUUID(), name: "TEST Paciente 1",  phone: "0000000003", roles: ["PACIENTE"] },
    { id: randomUUID(), name: "TEST Paciente 2",  phone: "0000000004", roles: ["PACIENTE"] },
    { id: randomUUID(), name: "TEST Paciente 3",  phone: "0000000005", roles: ["PACIENTE"] },
    { id: randomUUID(), name: "TEST Paciente 4",  phone: "0000000006", roles: ["PACIENTE"] },
    { id: randomUUID(), name: "TEST Paciente 5",  phone: "0000000007", roles: ["PACIENTE"] },
  ];

  const { data, error } = await admin.from("profiles").insert(perfiles).select("id, name");
  if (error) { console.log("Error:", error.message); return; }
  console.log("Creados:", data.map(p => p.name).join(", "));
}

run();
