import { createAdminClient } from "@/lib/supabase/admin";
import { TemplateEditor } from "./TemplateEditor";

const TEMPLATE_META: Record<string, { label: string; vars: string[] }> = {
  appointment_booked: {
    label: "Confirmación de cita",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}", "{{therapist_name}}", "{{address}}"],
  },
  appointment_reminder: {
    label: "Recordatorio de cita",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}", "{{therapist_name}}"],
  },
  appointment_cancelled: {
    label: "Cita cancelada (al paciente)",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}"],
  },
  appointment_confirmed_notify: {
    label: "Paciente confirmó (notif. interna)",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}"],
  },
  appointment_cancelled_by_patient: {
    label: "Paciente canceló (notif. interna)",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}"],
  },
  
  low_stock_alert: {
    label: "Alerta de inventario bajo",
    vars: ["{{product_name}}", "{{branch_name}}", "{{quantity}}", "{{min_quantity}}"],
  },
  
};

async function getData() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("whatsapp_templates")
    .select("key, body, description, updated_at")
    .order("key");
  return { templates: data ?? [] };
}

export default async function NotificacionesPage() {
  const { templates } = await getData();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
        <p className="text-sm text-gray-500 mt-1">
          Edita el texto de cada notificación automática que reciben los pacientes.
        </p>
      </div>

      {/* ── Info ── */}
      <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <span className="text-xl">🔔</span>
        <div>
          <p className="text-sm font-medium text-blue-900">Notificaciones Push activas</p>
          <p className="text-xs text-blue-600">
            Los mensajes se envían como notificaciones al celular del paciente.
          </p>
        </div>
      </div>

      {/* ── Templates ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Mensajes automáticos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Las variables entre {"{{dobles llaves}}"} se reemplazan automáticamente.
          </p>
        </div>
        {templates.map((tpl) => {
          const meta = TEMPLATE_META[tpl.key];
          return (
            <TemplateEditor
              key={tpl.key}
              templateKey={tpl.key}
              label={meta?.label ?? tpl.key}
              description={tpl.description ?? ""}
              body={tpl.body}
              availableVars={meta?.vars ?? []}
              updatedAt={tpl.updated_at}
            />
          );
        })}
      </div>
    </div>
  );
}
