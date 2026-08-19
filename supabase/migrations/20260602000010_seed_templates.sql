-- ============================================================
-- Migration 010 — Seed: templates de WhatsApp
-- CLAUDE.md regla 7: templates siempre desde esta tabla.
-- Alejandro puede editarlos desde el Master; estos son los
-- valores iniciales con variables {{placeholder}}.
-- ============================================================

INSERT INTO whatsapp_templates (key, body, description) VALUES

(
  'appointment_booked',
  E'Hola {{patient_name}} 👋\n\nTu cita en *DrNatury {{branch_name}}* quedó agendada.\n\n📅 {{date}}\n⏰ {{time}}\n👩‍⚕️ {{therapist_name}}\n📍 {{address}}\n\nConfirma o cancela tu cita:\n{{confirm_url}}',
  'Mensaje al paciente al agendar una cita'
),

(
  'appointment_reminder',
  E'Hola {{patient_name}}, te recordamos tu cita mañana.\n\n📅 {{date}} a las {{time}}\n🏥 DrNatury {{branch_name}}\n👩‍⚕️ {{therapist_name}}\n\n¿Confirmas tu asistencia?\n{{confirm_url}}',
  'Recordatorio antes de la cita — tiempo configurable por Alejandro'
),

(
  'appointment_cancelled',
  E'Hola {{patient_name}},\n\nTu cita del {{date}} a las {{time}} en DrNatury *{{branch_name}}* ha sido cancelada.\n\nPara agendar una nueva cita entra a:\n{{app_url}}',
  'Se envía a paciente, Alejandro y terapeuta al cancelarse una cita'
),

(
  'appointment_confirmed_notify',
  E'Confirmación recibida ✅\n\n*{{patient_name}}* confirmó su cita del {{date}} a las {{time}} en {{branch_name}}.',
  'Notificación a Alejandro y terapeuta cuando el paciente confirma'
),

(
  'appointment_cancelled_by_patient',
  E'El paciente *{{patient_name}}* canceló su cita del {{date}} a las {{time}} en {{branch_name}}.',
  'Notificación a Alejandro y terapeuta cuando el paciente cancela'
),

(
  'appointment_auto_cancelled',
  E'Hola {{patient_name}},\n\nTu cita del {{date}} fue cancelada automáticamente porque no recibimos tu confirmación.\n\nPara reagendar: {{app_url}}',
  'Cancelación automática por no respuesta — configurable por recordatorio'
),

(
  'low_stock_alert',
  E'⚠️ *Alerta de inventario*\n\n*{{product_name}}* en sucursal *{{branch_name}}* tiene solo {{quantity}} unidades.\nMínimo semanal: {{min_quantity}}.',
  'Alerta a Alejandro cuando un producto baja del mínimo'
),

(
  'supply_request',
  E'📦 *Solicitud de mercancía*\n\nDe: {{therapist_name}} ({{branch_name}})\n\n{{products_list}}\n\nVer detalle:\n{{detail_url}}',
  'Solicitud de mercancía a Alejandro y Almacenista'
);
