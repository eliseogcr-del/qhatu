-- Sin esto, una promoción tipo "lleva 12 y la 13 es gratis" se podía
-- aplicar con solo 1 unidad del producto atado en la venta -- la
-- validación original solo pedía que estuviera presente, no una
-- cantidad mínima. Default 1 para no romper las promociones que ya
-- existan (se comportan igual que antes).

alter table public.productos
  add column promocion_cantidad_minima numeric(12, 2) not null default 1;
