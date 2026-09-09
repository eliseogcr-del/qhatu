-- Excepción puntual al bloqueo global de precios (configuracion_precios):
-- productos marcados precio_editable siempre permiten escribir el precio
-- a mano en Pedidos, Ventas y Cotizaciones, sin importar el bloqueo ni
-- quién esté vendiendo. Pensado para líneas tipo "DELIVERY" (un cargo,
-- no un producto con precio de lista fijo).
alter table public.productos
  add column precio_editable boolean not null default false;
