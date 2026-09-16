-- Punto de partida y de llegada de la guía de remisión electrónica (GRE):
-- el almacén de origen y el cliente de destino necesitan su ubigeo
-- (código INEI) — ver 20260916000000_ubigeo_catalogo.sql. Nullable: solo
-- hace falta completarlo para los almacenes/clientes que reciben repartos
-- con guía, no para todos de entrada.

alter table public.almacenes
  add column ubigeo text references public.ubigeo (codigo);

alter table public.clientes
  add column ubigeo text references public.ubigeo (codigo);
