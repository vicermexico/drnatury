import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { esBotSlugValido, obtenerBotIdPorSlug } from "@/lib/whatsapp-bot/bots";

// GET: lista los productos vivos (no borrados) de un bot, cada uno con
// sus fotos (ver tabla producto_fotos).
export async function GET(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const bot = request.nextUrl.searchParams.get("bot");
  if (!esBotSlugValido(bot)) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta indicar el bot" }, { status: 400 });
  }

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, bot);

  const { data, error: dbErr } = await admin
    .from("productos")
    .select(
      "id, nombre, descripcion, precio, envio_tipo, envio_costo, pago_contra_entrega, created_at, producto_fotos(id, url, orden)"
    )
    .eq("bot_id", botId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  type Row = {
    id: string;
    nombre: string;
    descripcion: string | null;
    precio: number;
    envio_tipo: "gratis" | "costo";
    envio_costo: number | null;
    pago_contra_entrega: boolean;
    created_at: string;
    producto_fotos: { id: string; url: string; orden: number }[];
  };
  const productos = ((data ?? []) as unknown as Row[]).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: p.precio,
    envioTipo: p.envio_tipo,
    envioCosto: p.envio_costo,
    pagoContraEntrega: p.pago_contra_entrega,
    createdAt: p.created_at,
    fotos: [...p.producto_fotos].sort((a, b) => a.orden - b.orden).map((f) => ({ id: f.id, url: f.url })),
  }));

  return NextResponse.json({ productos });
}

// POST: da de alta un producto nuevo (sin fotos todavia -- esas se
// agregan despues con /api/master/productos/[id]/fotos).
export async function POST(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    bot?: string;
    nombre?: string;
    descripcion?: string;
    precio?: number;
    envioTipo?: "gratis" | "costo";
    envioCosto?: number;
    pagoContraEntrega?: boolean;
  };
  if (!esBotSlugValido(body.bot)) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta indicar el bot" }, { status: 400 });
  }
  const nombre = body.nombre?.trim();
  if (!nombre) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el nombre del producto" }, { status: 400 });
  }
  const precio = Number(body.precio);
  if (!Number.isFinite(precio) || precio < 0) {
    return NextResponse.json({ error: "INVALID_PRECIO", message: "El precio no es válido" }, { status: 400 });
  }
  const envioTipo = body.envioTipo === "costo" ? "costo" : "gratis";
  let envioCosto: number | null = null;
  if (envioTipo === "costo") {
    envioCosto = Number(body.envioCosto);
    if (!Number.isFinite(envioCosto) || envioCosto < 0) {
      return NextResponse.json({ error: "INVALID_ENVIO", message: "El costo de envío no es válido" }, { status: 400 });
    }
  }
  const pagoContraEntrega = body.pagoContraEntrega !== false;

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, body.bot);

  const { data: producto, error: dbErr } = await admin
    .from("productos")
    .insert({
      bot_id: botId,
      nombre,
      descripcion: body.descripcion?.trim() || null,
      precio,
      envio_tipo: envioTipo,
      envio_costo: envioCosto,
      pago_contra_entrega: pagoContraEntrega,
    })
    .select("id, nombre, descripcion, precio, envio_tipo, envio_costo, pago_contra_entrega, created_at")
    .single();

  if (dbErr || !producto) {
    return NextResponse.json({ error: "DB_ERROR", message: dbErr?.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      envioTipo: producto.envio_tipo,
      envioCosto: producto.envio_costo,
      pagoContraEntrega: producto.pago_contra_entrega,
      createdAt: producto.created_at,
      fotos: [],
    },
    { status: 201 }
  );
}
