-- Telefono opcional del paciente para las citas creadas desde el link
-- rapido de Master (ver 20261028000001_quick_link_setup.sql). Se llena
-- solo si Master incluyo un telefono en el texto que pego al agendar, y
-- se usa para ofrecer un boton de WhatsApp directo en la pagina de la
-- cita (/cita/[id]) y en la vista interna (/master/citas/[id]).
alter table appointments add column if not exists quick_phone text;
