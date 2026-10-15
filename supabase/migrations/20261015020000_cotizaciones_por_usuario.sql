-- La política de cotizaciones solo exigía empresa_id + puede_ver_comercial()
-- (admin, logística o vendedor) — sin ninguna restricción por usuario, así
-- que cualquier vendedor veía las cotizaciones de TODOS los demás
-- vendedores (de cualquier almacén/canal), no solo las suyas. Admin y
-- logística siguen viendo todo; un vendedor ahora solo ve (y edita) las
-- cotizaciones que él mismo creó.

drop policy if exists "cotizaciones: select" on public.cotizaciones;
create policy "cotizaciones: select" on public.cotizaciones
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or usuario_id = auth.uid())
  );

drop policy if exists "cotizaciones: update" on public.cotizaciones;
create policy "cotizaciones: update" on public.cotizaciones
  for update using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or usuario_id = auth.uid())
  )
  with check (empresa_id = public.current_empresa_id());

-- cotizacion_detalle no tiene usuario_id propio y su política original
-- verificaba empresa_id + puede_ver_comercial() de forma independiente
-- (no "si puedo ver la fila de cotizaciones") — así que aunque se
-- arregle la de arriba, esta seguía dejando ver las líneas de producto
-- de la cotización de cualquier otro vendedor. Se corrige igual.
drop policy if exists "cotizacion_detalle: select" on public.cotizacion_detalle;
create policy "cotizacion_detalle: select" on public.cotizacion_detalle
  for select using (
    exists (
      select 1 from public.cotizaciones c
      where c.id = cotizacion_detalle.cotizacion_id
        and c.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or c.usuario_id = auth.uid())
    )
  );
