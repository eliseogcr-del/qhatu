-- El precio especial de un cliente se negocia para una unidad de medida
-- específica (ej. "S/30 por DOCENA"), igual que Precio Campo/Digital son
-- por la unidad de medida por defecto del producto — sin esto, el precio
-- especial se aplicaba tal cual sin importar qué unidad se eligiera en el
-- pedido/venta, lo cual es incorrecto si esa unidad no es la que negoció
-- el cliente. La tabla recién se creó y todavía no tiene filas en ninguna
-- instalación, así que no hace falta backfill.
alter table public.precios_especiales_cliente
  add column unidad_medida_id uuid not null references public.unidades_medida (id);
