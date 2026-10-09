import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";
import type { IrisFindingMatch } from "@/types";

// Compara la foto de iris de un paciente contra el banco de referencia
// usando IA con vision. Solo Master y Terapeuta pueden llamar esto y
// ver el resultado — NUNCA el paciente. Esto es una herramienta
// experimental de estudio/orientacion, NO un diagnostico medico (la
// iridologia no esta comprobada cientificamente) — el disclaimer va
// siempre fijo en la respuesta.

const DISCLAIMER =
  "Esto NO es un diagnostico medico. La iridologia no esta comprobada " +
  "cientificamente. Es solo una comparacion visual generada por IA para " +
  "estudio y orientacion personal — nunca debe usarse para diagnosticar " +
  "ni tratar a un paciente, ni sustituye atencion medica profesional.";

const MODEL = "claude-sonnet-4-5";

async function downloadAsBase64(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  path: string
): Promise<{ base64: string; mediaType: string } | null> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = data.type && data.type.startsWith("image/") ? data.type : "image/jpeg";
  return { base64, mediaType };
}

export async function POST(request: NextRequest) {
  const { error, userId } = await guardAnyRole("MASTER", "TERAPEUTA");
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "MISSING_API_KEY", message: "Falta configurar ANTHROPIC_API_KEY en Vercel" },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { patient_photo_id?: string };
  const { patient_photo_id } = body;
  if (!patient_photo_id) return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });

  const admin = createAdminClient();

  const { data: photo } = await admin
    .from("iris_patient_photos")
    .select("id, image_path, eye")
    .eq("id", patient_photo_id)
    .is("deleted_at", null)
    .single();
  if (!photo) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { data: references } = await admin
    .from("iris_reference_images")
    .select("id, label, meaning, zone, image_path")
    .is("deleted_at", null);

  if (!references || references.length === 0) {
    return NextResponse.json(
      { error: "NO_REFERENCES", message: "Primero agrega imagenes al banco de referencia" },
      { status: 400 }
    );
  }

  const patientImg = await downloadAsBase64(admin, "iris-photos", photo.image_path);
  if (!patientImg) return NextResponse.json({ error: "DOWNLOAD_ERROR" }, { status: 500 });

  const refImages = await Promise.all(
    references.map(async (r) => ({
      ref: r,
      img: await downloadAsBase64(admin, "iris-reference", r.image_path),
    }))
  );
  const validRefs = refImages.filter((r) => r.img !== null);

  const content: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text:
        "Eres un asistente que SOLO describe similitudes visuales de " +
        "color, textura y patron entre fotos de iris, para un ejercicio " +
        "personal de estudio sobre iridologia. NO estas dando un " +
        "diagnostico medico, la iridologia no esta comprobada " +
        "cientificamente, y debes usar siempre lenguaje de posibilidad " +
        "(\"podria parecerse a\", \"patron visualmente similar a\"), nunca " +
        "lenguaje afirmativo de diagnostico (\"tiene\", \"padece\").\n\n" +
        "Te voy a dar: (1) la foto del iris de un paciente, y (2) varias " +
        "imagenes de referencia, cada una con un nombre y lo que " +
        `representa en este ejercicio. Esta es la foto del ojo ${photo.eye === "IZQUIERDO" ? "izquierdo" : "derecho"} del paciente:`,
    },
    {
      type: "image",
      source: { type: "base64", media_type: patientImg.mediaType as "image/jpeg", data: patientImg.base64 },
    },
    { type: "text", text: "Ahora las imagenes de referencia:" },
    ...validRefs.flatMap((r) => [
      {
        type: "text" as const,
        text: `Referencia id="${r.ref.id}" nombre="${r.ref.label}"${r.ref.zone ? ` zona="${r.ref.zone}"` : ""} representa: ${r.ref.meaning}`,
      },
      {
        type: "image" as const,
        source: { type: "base64" as const, media_type: r.img!.mediaType as "image/jpeg", data: r.img!.base64 },
      },
    ]),
    {
      type: "text",
      text:
        "Responde UNICAMENTE con JSON valido (sin texto extra, sin " +
        "markdown) con esta forma exacta:\n" +
        '{"summary": "resumen general en 2-3 frases, con lenguaje de posibilidad", ' +
        '"matches": [{"reference_image_id": "<id de la referencia>", "similarity_note": "nota breve de la similitud visual encontrada, o por que no aplica"}]}\n' +
        "Incluye una entrada en matches por cada referencia que te di, incluso si la similitud es baja (dilo en la nota).",
    },
  ];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let aiText: string;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    });
    const block = response.content.find((b) => b.type === "text");
    aiText = block && block.type === "text" ? block.text : "";
  } catch (err) {
    return NextResponse.json(
      { error: "AI_ERROR", message: err instanceof Error ? err.message : "Error al llamar a la IA" },
      { status: 500 }
    );
  }

  let parsed: { summary?: string; matches?: { reference_image_id: string; similarity_note: string }[] };
  try {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiText);
  } catch {
    return NextResponse.json({ error: "PARSE_ERROR", message: "La IA no regreso un formato valido" }, { status: 500 });
  }

  const refById = new Map(references.map((r) => [r.id, r]));
  const matches: IrisFindingMatch[] = (parsed.matches ?? []).map((m) => {
    const ref = refById.get(m.reference_image_id);
    return {
      reference_image_id: m.reference_image_id,
      label: ref?.label ?? "Referencia",
      meaning: ref?.meaning ?? "",
      similarity_note: m.similarity_note ?? "",
    };
  });

  const { data: finding, error: dbErr } = await admin
    .from("iris_findings")
    .insert({
      patient_photo_id,
      summary: parsed.summary ?? "",
      matches,
      disclaimer: DISCLAIMER,
      created_by: userId,
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(finding, { status: 201 });
}
