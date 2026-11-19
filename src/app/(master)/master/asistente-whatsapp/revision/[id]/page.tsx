import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { RevisionConversacion } from "./RevisionConversacion";

export default async function RevisionConversacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: mensajes } = await admin
    .from("chat_messages")
    .select("id, rol, texto, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

  if (!mensajes || mensajes.length === 0) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/master/asistente-whatsapp/revision" className="text-sm text-blue-600 hover:underline">
          ← Revisar mensajes no cerrados
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Conversación</h1>
        <p className="text-sm text-gray-500 mt-1">
          Dale clic a la respuesta del bot donde se equivocó para enseñarle qué debió haber contestado.
        </p>
      </div>

      <RevisionConversacion
        mensajes={mensajes.map((m) => ({ id: m.id, rol: m.rol as "paciente" | "bot", texto: m.texto }))}
      />
    </div>
  );
}
