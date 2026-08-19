import { createAdminClient } from "@/lib/supabase/admin";
import { WhatsappCitasForm } from "./WhatsappCitasForm";

async function getTemplates() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("whatsapp_templates")
    .select("key, body")
    .in("key", ["cita_con_pdf", "cita_sin_pdf"]);
  const map: Record<string, string> = {};
  for (const t of data ?? []) map[t.key] = t.body;
  return {
    conPdf:  map["cita_con_pdf"]  ?? "",
    sinPdf:  map["cita_sin_pdf"]  ?? "",
  };
}

export default async function WhatsappCitasPage() {
  const templates = await getTemplates();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Citas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configura los mensajes que se envian al paciente desde la agenda
        </p>
      </div>
      <WhatsappCitasForm conPdf={templates.conPdf} sinPdf={templates.sinPdf} />
    </div>
  );
}
