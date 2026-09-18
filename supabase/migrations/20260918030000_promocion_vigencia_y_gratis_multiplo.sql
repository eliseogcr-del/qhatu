-- Dos ajustes al diseño de promociones:
-- 1) Vigencia por fecha/hora: además del interruptor manual
--    (promocion_activa), una campaña puede tener inicio y fin. Si están
--    vacíos, no hay restricción de fecha (se comporta como antes).
-- 2) El precio de la promoción es siempre 0 (no un monto configurable
--    que se desactualiza si cambia el precio del producto atado) —
--    precio_campo/precio_digital ya existen, solo cambia cómo se llenan
--    (siempre 0) desde acá en adelante.

alter table public.productos
  add column promocion_inicio timestamptz,
  add column promocion_fin timestamptz;
