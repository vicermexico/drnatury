-- Arregla las notificaciones push:
--
-- 1. profiles.push_token ya existia en la base de datos en produccion
--    (se agrego en algun momento directo desde el dashboard de Supabase,
--    sin migracion versionada — viola la regla 9 de CLAUDE.md). Esta
--    migracion reconcilia el repo con la realidad de la base de datos
--    usando IF NOT EXISTS, para que quede documentado en el historial.
--
-- 2. whatsapp_templates no tenia columna "description", pero la pantalla
--    /master/whatsapp la selecciona (select("key, body, description,
--    updated_at")) — eso hacia fallar la consulta completa y la pantalla
--    de "Notificaciones" del master no mostraba NINGUNA plantilla para
--    editar, aunque la pagina cargaba sin error visible.
--
-- 3. Las plantillas de whatsapp_templates usadas por las notificaciones
--    push (via renderTemplate en src/lib/push/send.ts) esperan variables
--    con doble llave en ingles, ej. {{patient_name}}, {{date}} — pero las
--    filas ya existentes en la base usaban llave sencilla en espanol,
--    ej. {nombre}, {fecha} (una convencion distinta, usada por el envio
--    manual de WhatsApp con PDF). Como nunca coincidian, cualquier push
--    que se lograra enviar salia con los placeholders sin reemplazar.
--    Se actualizan esas filas y se agregan las que faltaban por completo
--    (appointment_booked, appointment_confirmed_notify,
--    appointment_cancelled_by_patient, low_stock_alert), usando las
--    variables exactas que ya manda el codigo y que ya declara la
--    pantalla de edicion en /master/whatsapp.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS description TEXT;

-- 4. /api/cron/reminders (el recordatorio push 24h antes de la cita) ya
--    filtraba por appointments.reminder_sent, pero esa columna nunca se
--    creo — la consulta fallaba silenciosamente con error de base de
--    datos cada vez que Vercel intentara correr ese cron.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;

INSERT INTO whatsapp_templates (key, body, description)
VALUES
  (
    'appointment_booked',
    'Hola {{patient_name}}, tu cita en DrNatury quedó registrada para el {{date}} a las {{time}} en {{branch_name}}. Confirma o cancela aquí: {{confirm_url}}',
    'Notificación al paciente cuando se agenda una cita nueva'
  ),
  (
    'appointment_confirmed_notify',
    '{{patient_name}} confirmó su cita del {{date}} a las {{time}} en {{branch_name}}.',
    'Notificación interna (master/asistente/terapeuta) cuando el paciente confirma su cita'
  ),
  (
    'appointment_cancelled_by_patient',
    '{{patient_name}} canceló su cita del {{date}} a las {{time}} en {{branch_name}}.',
    'Notificación interna (master/asistente/terapeuta) cuando el paciente cancela su cita'
  ),
  (
    'low_stock_alert',
    'Inventario bajo: {{product_name}} en {{branch_name}} — quedan {{quantity}}, mínimo {{min_quantity}}.',
    'Notificación al master cuando un producto baja del mínimo semanal'
  )
ON CONFLICT (key) DO UPDATE SET
  body = EXCLUDED.body,
  description = EXCLUDED.description;

UPDATE whatsapp_templates
SET body = 'Hola {{patient_name}}, te recordamos tu cita mañana {{date}} a las {{time}} en {{branch_name}}.'
WHERE key = 'appointment_reminder';

UPDATE whatsapp_templates
SET body = 'Hola {{patient_name}}, tu cita del {{date}} a las {{time}} en {{branch_name}} ha sido cancelada.'
WHERE key = 'appointment_cancelled';
