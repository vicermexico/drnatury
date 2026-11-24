-- Fase 3 (panel del chofer): cuando el chofer marca un pedido como
-- "entregado" o "rechazado" desde su panel, se necesita guardar CUANDO
-- paso (para el resumen diario de Master, siguiente parte de la Fase
-- 3) y, si fue rechazado, POR QUE (para que Master sepa si hay que
-- reprogramar la entrega, cancelar el pedido, etc.).
alter table pomada_pedidos add column if not exists entregado_at timestamptz;
alter table pomada_pedidos add column if not exists motivo_rechazo text;

notify pgrst, 'reload schema';
