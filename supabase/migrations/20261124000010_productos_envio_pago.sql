-- Paso 1 de "mostrar productos en el chat tipo revista" (pedido de Vic,
-- 2026-11-24): antes de la parte visual, cada producto necesita decir
-- si el envio es gratis o tiene costo, y si el pago es contra entrega o
-- por adelantado -- informacion que el cliente va a ver en su tarjeta.
alter table productos
  add column if not exists envio_tipo text not null default 'gratis' check (envio_tipo in ('gratis', 'costo')),
  add column if not exists envio_costo numeric check (envio_costo is null or envio_costo >= 0),
  add column if not exists pago_contra_entrega boolean not null default true;

notify pgrst, 'reload schema';
