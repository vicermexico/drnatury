const fs = require("fs");
const { Client } = require("pg");

const env = fs.readFileSync(".env.local", "utf8");
const dbUrl = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim() ?? 
              env.match(/POSTGRES_URL=(.+)/)?.[1]?.trim() ??
              env.match(/SUPABASE_DB_URL=(.+)/)?.[1]?.trim();

console.log("DB URL:", dbUrl ? "encontrada" : "NO encontrada");
