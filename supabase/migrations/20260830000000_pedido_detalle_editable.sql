-- pedido_detalle solo tenía select/insert (se diseñó pensando que un
-- pedido nunca se editaba). Al agregar la edición de pedidos (mientras
-- están pendientes de confirmación) hace falta poder reemplazar sus
-- líneas — sin esto, igual que pasó con venta_detalle
-- (20260805000100), RLS y GRANT bloquearían el delete en silencio.

create policy "pedido_detalle: delete por almacen" on public.pedido_detalle
  for delete using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_detalle.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.es_admin() or p.almacen_id = public.current_almacen_id())
    )
  );

grant delete on public.pedido_detalle to authenticated;
