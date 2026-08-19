import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

async function getCita(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("appointments")
    .select("id, pdf_url, starts_at, patient:profiles!patient_id(name), services(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export default async function ResultadoCitaPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cita = await getCita(id);

  if (!cita || !cita.pdf_url) notFound();

  const patient = Array.isArray(cita.patient) ? cita.patient[0] : cita.patient as { name: string } | null;
  const service = Array.isArray(cita.services) ? cita.services[0] : cita.services as { name: string } | null;
  const fecha = new Date(cita.starts_at).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "America/Monterrey",
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">DrNatury</h1>
          <p className="text-sm text-gray-500">Resultado de tu consulta</p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-2">
          {patient && <p className="text-sm font-semibold text-gray-900">{patient.name}</p>}
          {service && <p className="text-sm text-gray-600">{service.name}</p>}
          <p className="text-xs text-gray-400 capitalize">{fecha}</p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <iframe src={cita.pdf_url} className="w-full h-[70vh]" title="Resultado PDF" />
        </div>

        <a href={cita.pdf_url} download target="_blank" rel="noopener noreferrer" className="block w-full text-center rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition">
          Descargar PDF
        </a>
      </div>
    </div>
  );
}
