-- Hora de reparto, para mostrarla junto a la fecha en el PDF del pedido
-- (impreso para logística) — hasta ahora solo se guardaba el día.
alter table public.repartos add column hora_reparto time;
