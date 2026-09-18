-- Antes: cantidad regalada fija en 1 por cada cantidad mínima alcanzada,
-- y precio siempre 0. Ahora ambos son configurables por promoción, para
-- soportar variantes como "compra 12, llévate 2 gratis" (cantidad_regalo
-- = 2) o "compra 12, paga la mitad" (precio > 0 pero menor al normal).
-- Default 1 / 0 para que las promociones ya configuradas sigan
-- comportándose exactamente igual que antes.

alter table public.productos
  add column promocion_cantidad_regalo numeric(12, 2) not null default 1,
  add column promocion_precio numeric(12, 2) not null default 0;
