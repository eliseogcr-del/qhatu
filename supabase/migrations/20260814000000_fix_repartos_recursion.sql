-- Corrige "infinite recursion detected in policy for relation repartos":
-- la policy de select de pedidos consultaba repartos (para el caso del
-- repartidor asignado), y la de repartos consulta pedidos (para el caso
-- de almacén) — al evaluarse una a la otra en círculo, Postgres detecta
-- la recursión y rechaza la consulta.
--
-- Arreglo: la comprobación "¿soy el repartidor de este pedido?" se mueve
-- a una función security definer. Al ser security definer, su lectura
-- interna de repartos NO vuelve a evaluar la policy de repartos (corre
-- con permisos elevados, igual que current_empresa_id()) — así que la
-- cadena pedidos → repartos → pedidos → ... nunca se completa.

create or replace function public.es_repartidor_de_pedido(p_pedido_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.repartos r
    where r.pedido_id = p_pedido_id and r.repartidor_id = auth.uid()
  )
$$;

drop policy if exists "pedidos: select por rol" on public.pedidos;
create policy "pedidos: select por rol" on public.pedidos
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or almacen_id = public.current_almacen_id()
      or public.es_repartidor_de_pedido(pedidos.id)
    )
  );

drop policy if exists "pedido_detalle: select por rol" on public.pedido_detalle;
create policy "pedido_detalle: select por rol" on public.pedido_detalle
  for select using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_detalle.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (
          public.puede_ver_todos_almacenes()
          or p.almacen_id = public.current_almacen_id()
          or public.es_repartidor_de_pedido(p.id)
        )
    )
  );

drop policy if exists "pedido_adjuntos: select por rol" on public.pedido_adjuntos;
create policy "pedido_adjuntos: select por rol" on public.pedido_adjuntos
  for select using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_adjuntos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (
          public.puede_ver_todos_almacenes()
          or p.almacen_id = public.current_almacen_id()
          or public.es_repartidor_de_pedido(p.id)
        )
    )
  );
