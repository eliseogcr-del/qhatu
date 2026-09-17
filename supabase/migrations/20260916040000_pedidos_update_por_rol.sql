-- El SELECT de pedidos se amplió en 20260813 para que logística viera
-- pedidos de todos los almacenes (necesario para que Reparto tenga
-- sentido), pero el UPDATE se quedó atado al almacén propio del usuario
-- (igual que antes de esa migración). Resultado: logística podía abrir
-- un pedido de otro almacén y tocar "Actualizar estado", pero el UPDATE
-- afectaba 0 filas sin ningún error — RLS bloqueando en silencio (mismo
-- patrón que pedido_detalle en 20260830) — así que el estado se quedaba
-- igual sin avisar nada.

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
