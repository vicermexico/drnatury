-- Template para la notificacion push que le llega a la terapeuta cuando
-- un paciente agenda desde el link (respaldo por si no manda el mensaje
-- de WhatsApp). CLAUDE.md regla 7: nunca hardcoded, siempre desde tabla.
INSERT INTO whatsapp_templates (key, body, description)
VALUES (
  'appointment_booked_therapist',
  'Nueva cita agendada ✅ {{patient_name}} — {{date}} {{time}} — {{service_name}}. Toca para verla y guardarla en tu calendario.',
  'Notificacion push al terapeuta cuando un paciente agenda desde el link para agendar'
)
ON CONFLICT (key) DO NOTHING;
