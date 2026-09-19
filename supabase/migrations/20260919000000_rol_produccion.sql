-- Nuevo rol "produccion": un operario de planta que solo registra
-- producción para SU almacén fijo (a diferencia de admin/logística, que
-- pueden hacerlo para cualquiera). Las políticas de producciones/
-- produccion_detalle solo dejaban pasar a quien puede_ver_todos_almacenes()
-- (admin/logística) — se agrega el fallback a current_almacen_id(), mismo
-- patrón que abastecimiento_campo, para que este rol también pueda operar,
-- pero solo dentro de su propio almacén.

drop policy if exists "producciones: select admin/logistica" on public.producciones;
create policy "producciones: select por rol" on public.producciones
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );

drop policy if exists "producciones: insert admin/logistica" on public.producciones;
create policy "producciones: insert por rol" on public.producciones
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );

drop policy if exists "producciones: update admin/logistica" on public.producciones;
create policy "producciones: update por rol" on public.producciones
  for update using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );

drop policy if exists "produccion_detalle: select admin/logistica" on public.produccion_detalle;
create policy "produccion_detalle: select por rol" on public.produccion_detalle
  for select using (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or p.almacen_id = public.current_almacen_id())
    )
  );

drop policy if exists "produccion_detalle: insert admin/logistica" on public.produccion_detalle;
create policy "produccion_detalle: insert por rol" on public.produccion_detalle
  for insert with check (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or p.almacen_id = public.current_almacen_id())
    )
  );

drop policy if exists "produccion_detalle: update admin/logistica" on public.produccion_detalle;
create policy "produccion_detalle: update por rol" on public.produccion_detalle
  for update using (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or p.almacen_id = public.current_almacen_id())
    )
  )
  with check (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or p.almacen_id = public.current_almacen_id())
    )
  );

drop policy if exists "produccion_detalle: delete admin/logistica" on public.produccion_detalle;
create policy "produccion_detalle: delete por rol" on public.produccion_detalle
  for delete using (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or p.almacen_id = public.current_almacen_id())
    )
  );
