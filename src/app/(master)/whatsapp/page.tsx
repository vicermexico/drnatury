import { createAdminClient } from "@/lib/supabase/admin";
import { TemplateEditor } from "./TemplateEditor";

// Variables disponibles por template — para que Alejandro sepa qué puede usar
const TEMPLATE_META: Record<string, { label: string; vars: string[] }> = {
  appointment_booked: {
    label: "Confirmación de cita",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}", "{{therapist_name}}", "{{address}}", "{{confirm_url}}"],
  },
  appointment_reminder: {
    label: "Recordatorio de cita",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}", "{{therapist_name}}", "{{confirm_url}}"],
  },
  appointment_cancelled: {
    label: "Cita cancelada (al paciente)",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}", "{{app_url}}"],
  },
  appointment_confirmed_notify: {
    label: "Paciente confirmó (notif. interna)",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}"],
  },
  appointment_cancelled_by_patient: {
    label: "Paciente canceló (notif. interna)",
    vars: ["{{patient_name}}", "{{branch_name}}", "{{date}}", "{{time}}"],
  },
  appointment_auto_cancelled: {
    label: "Cancelación automática por no respuesta",
    vars: ["{{patient_name}}", "{{date}}", "{{app_url}}"],
  },
  low_stock_alert: {
    label: "Alerta de inventario bajo",
    vars: ["{{product_name}}", "{{branch_name}}", "{{quantity}}", "{{min_quantity}}"],
  },
  supply_request: {
    label: "Solicitud de mercancía",
    vars: ["{{therapist_name}}", "{{branch_name}}", "{{products_list}}", "{{detail_url}}"],
  },
};

async function getTemplates() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("whatsapp_templates")
    .select("key, body, description, updated_at")
    .order("key");
  return data ?? [];
}

export default async function WhatsAppTemplatesPage() {
  const templates = await getTemplates();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Templates de WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-1">
          Edita el texto de cada mensaje. Las variables entre {"{{dobles llaves}}"} se reemplazan automáticamente.
        </p>
      </div>

      <div className="space-y-4">
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
