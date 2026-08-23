-- Reemplaza el bloque libre "condiciones_comerciales" por tres campos
-- estructurados que el cliente espera ver siempre en el PDF: vigencia de
-- la oferta, fecha de entrega y lugar de entrega. condiciones_comerciales
-- se deja intacta (no se borra) por las cotizaciones ya emitidas que la
-- usaron -- solo deja de llenarse desde el formulario en adelante.

alter table public.cotizaciones add column oferta_valida_hasta date;
alter table public.cotizaciones add column fecha_entrega date;
alter table public.cotizaciones add column lugar_entrega text;
