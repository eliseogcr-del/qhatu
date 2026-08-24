-- Descuento en monto fijo (no porcentaje) aplicado a toda la venta, por
-- defecto 0. Reduce lo que realmente hay que cobrar (total - descuento)
-- sin tocar venta_detalle ni el total "bruto" que usan Nota de
-- venta/Factura/Boleta (esos documentos siguen reflejando la suma real de
-- líneas; el descuento solo afecta cuánto se le pide de vuelta al cliente).

alter table public.ventas add column descuento numeric(12, 2) not null default 0;
alter table public.ventas add constraint ventas_descuento_no_negativo check (descuento >= 0);
