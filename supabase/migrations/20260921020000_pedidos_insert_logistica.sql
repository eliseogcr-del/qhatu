-- Cuando se agregó el rol logística (20260813000000_roles_logistica_repartidor.sql)
-- se amplió el SELECT de pedidos con puede_ver_todos_almacenes(), pero
-- insert/update se dejaron con es_admin() a propósito, con el comentario
-- "crear pedidos sigue siendo cosa de admin/vendedor, logística y
-- repartidor solo necesitan verlos" — válido en ese momento, porque
-- logística todavía no tenía ninguna pantalla que creara un pedido.
--
-- Eso cambió con Venta directa/Venta rápida para admin/logística: por
-- debajo, cada venta sin pedido previo crea un "pedido directo" (ver
-- ventas/actions.ts). Como logística no tiene almacen_id fijo
-- (current_almacen_id() es null) y es_admin() es false para su rol, el
-- insert violaba esta policy — la venta nunca llegaba a crearse.
drop policy if exists "pedidos: insert por almacen" on public.pedidos;
create policy "pedidos: insert por rol" on public.pedidos
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );

drop policy if exists "pedidos: update por almacen" on public.pedidos;
create policy "pedidos: update por rol" on public.pedidos
  for update using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );
