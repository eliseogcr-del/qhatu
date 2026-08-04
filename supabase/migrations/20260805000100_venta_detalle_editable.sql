-- venta_detalle solo tenía select/insert (se diseñó pensando que una
-- venta nunca se editaba). Al agregar la edición de ventas hacían falta
-- update/delete — sin esto, "Quitar producto"/"modificar cantidad" en el
-- formulario de edición fallaba en silencio: RLS y GRANT bloqueaban la
-- operación, pero la app no revisaba el error, así que la UI mostraba el
-- cambio pero la base de datos lo ignoraba.

create policy "venta_detalle: update por empresa" on public.venta_detalle
  for update using (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
    )
  )
  with check (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
    )
  );

create policy "venta_detalle: delete por empresa" on public.venta_detalle
  for delete using (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
    )
  );

grant update, delete on public.venta_detalle to authenticated;
