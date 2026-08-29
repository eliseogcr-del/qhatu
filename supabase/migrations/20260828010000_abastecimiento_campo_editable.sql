-- Permite corregir un abastecimiento en campo ya registrado (cantidad
-- equivocada, producto equivocado, quitar una línea) sin perder
-- trazabilidad: la edición emite movimientos de kardex compensatorios
-- ('ajuste') por la diferencia, igual que al editar una venta. Proveedor
-- y almacén no son editables (cambiarlos movería stock ya contabilizado
-- entre almacenes, un caso distinto — ver traslados). Si el
-- abastecimiento ya generó su compra espejo (20260828000000) y esa
-- compra ya fue validada, la edición queda bloqueada a nivel de
-- aplicación -- Admin/Logística ya aprobó esos números.

-- Igual que pedido_detalle/venta_detalle: unidad elegida en esa línea
-- puntual (puede diferir de la unidad por defecto del producto).
-- Nullable a nivel de BD para no romper filas históricas; la aplicación
-- la completa siempre de acá en adelante.
alter table public.abastecimiento_campo_detalle
  add column unidad_medida_id uuid references public.unidades_medida (id);

update public.abastecimiento_campo_detalle d
set unidad_medida_id = u.id
from public.abastecimientos_campo a
join public.unidades_medida u on u.empresa_id = a.empresa_id and u.codigo = 'UND'
where d.abastecimiento_id = a.id and d.unidad_medida_id is null;

create policy "abastecimientos_campo: update por rol" on public.abastecimientos_campo
  for update using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );

create policy "abastecimiento_campo_detalle: update por rol" on public.abastecimiento_campo_detalle
  for update using (
    exists (
      select 1 from public.abastecimientos_campo a
      where a.id = abastecimiento_campo_detalle.abastecimiento_id
        and a.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or a.almacen_id = public.current_almacen_id())
    )
  )
  with check (
    exists (
      select 1 from public.abastecimientos_campo a
      where a.id = abastecimiento_campo_detalle.abastecimiento_id
        and a.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or a.almacen_id = public.current_almacen_id())
    )
  );
create policy "abastecimiento_campo_detalle: delete por rol" on public.abastecimiento_campo_detalle
  for delete using (
    exists (
      select 1 from public.abastecimientos_campo a
      where a.id = abastecimiento_campo_detalle.abastecimiento_id
        and a.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or a.almacen_id = public.current_almacen_id())
    )
  );

grant update on public.abastecimientos_campo to authenticated;
grant update, delete on public.abastecimiento_campo_detalle to authenticated;

-- Necesaria para poder regenerar las líneas de la compra espejo
-- (todavía sin validar) cuando se edita el abastecimiento que la generó.
create policy "compra_detalle: delete por rol" on public.compra_detalle
  for delete using (
    exists (
      select 1 from public.compras c
      where c.id = compra_detalle.compra_id
        and c.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or c.almacen_id = public.current_almacen_id())
    )
  );

grant delete on public.compra_detalle to authenticated;
