export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { LandingPage } from "@/components/landing/LandingPage";

async function getConfig() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("landing_config")
    .select("*")
    .single();
  return data;
}

async function getServices() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("landing_services")
    .select("*")
    .eq("is_active", true)
    .order("order_index");
  return data ?? [];
}

async function getFondos() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("landing_fondos")
    .select("id, tipo, url")
    .eq("is_active", true)
    .order("orden")
    .order("created_at");
  return data ?? [];
}

async function getPersonajes() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("landing_personajes")
    .select("id, nombre, puesto, imagen_url")
    .eq("is_active", true)
    .order("orden")
    .order("created_at");
  return (data ?? []).map((p) => ({ id: p.id, nombre: p.nombre, puesto: p.puesto, url: p.imagen_url }));
}

export default async function InicioPage() {
  const config = await getConfig();
  const services = await getServices();
  const fondos = await getFondos();
  const personajes = await getPersonajes();

  return <LandingPage config={config} services={services} fondos={fondos} personajes={personajes} />;
}

