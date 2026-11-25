-- Vic pidio poder elegir, para cada bot (citas y pomada), a que numero
-- de WhatsApp se manda la confirmacion final y el boton nuevo de la
-- cabecera del chat ("Mandanos un WhatsApp") -- antes estaba fijo en
-- el codigo (el mismo numero de prueba para los dos bots). El default
-- es ese mismo numero, para que nada cambie hasta que Master lo edite
-- desde Master -> Perfil del chat.
alter table whatsapp_bots
  add column if not exists chat_whatsapp_numero text not null default '528117105018';

notify pgrst, 'reload schema';
