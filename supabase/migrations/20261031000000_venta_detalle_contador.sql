-- La nota de venta para el contador daba 404: la página
-- (/comprobantes/nota-venta/[id]) construye el detalle leyendo
-- venta_detalle, pero esa tabla solo se liberó para admin/logística o
-- el propio almacén (20260910000000_ventas_logistica.sql) — nunca se
-- agregó es_contador(), a diferencia de lo que sí se hizo en
-- comprobantes/ventas (20260921000000_rol_contador.sql). Entonces, para
-- una venta de un almacén que no es el del contador, venta_detalle
-- devolvía 0 filas, construirItemsYTotales() retornaba null y la página
-- llamaba notFound().

drop policy if exists "venta_detalle: select por rol" on public.venta_detalle;
create policy "venta_detalle: select por rol" on public.venta_detalle
  for select using (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
        and (
          public.puede_ver_todos_almacenes()
          or public.es_contador()
          or v.almacen_id = public.current_almacen_id()
        )
    )
  );
