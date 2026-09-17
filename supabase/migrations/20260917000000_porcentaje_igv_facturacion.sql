-- Factura/boleta/nota de crédito y nota de venta calculaban el IGV con un
-- 18% fijo en el código (comprobantes.ts), sin relación con el porcentaje
-- real de esta empresa (10.5%, el mismo que ya es configurable para
-- Cotizaciones desde 20260823000000). Se agrega acá, junto a las series
-- de Nubefact, para que todo lo que se le envía a SUNAT use el valor real.

alter table public.configuracion_facturacion
  add column porcentaje_igv numeric(5, 2) not null default 10.5;
