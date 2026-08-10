-- Roles nuevos: logistica (ve/opera en Reparto, Traslados, Abastecimiento
-- en campo, Inventario y Kardex de TODOS los almacenes, sin entrar a
-- Usuarios/Facturación/Auditoría) y repartidor (solo ve y actualiza el
-- estado de los repartos que tiene asignados — nada más). No hace falta
-- alterar la columna usuarios.rol (es texto libre, sin check constraint).

create or replace function public.puede_ver_todos_almacenes()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(rol in ('admin', 'logistica'), false) from public.usuarios where id = auth.uid()
$$;

-- ── pedidos / pedido_detalle / pedido_adjuntos: ampliar SELECT ─────────
-- (insert/update de pedidos se quedan como estaban — crear pedidos sigue
-- siendo cosa de admin/vendedor, logística y repartidor solo necesitan
-- verlos para que Reparto tenga sentido).

drop policy if exists "pedidos: select por almacen" on public.pedidos;
create policy "pedidos: select por rol" on public.pedidos
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or almacen_id = public.current_almacen_id()
      or exists (
        select 1 from public.repartos r
        where r.pedido_id = pedidos.id and r.repartidor_id = auth.uid()
      )
    )
  );

drop policy if exists "pedido_detalle: select por almacen" on public.pedido_detalle;
create policy "pedido_detalle: select por rol" on public.pedido_detalle
  for select using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_detalle.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (
          public.puede_ver_todos_almacenes()
          or p.almacen_id = public.current_almacen_id()
          or exists (
            select 1 from public.repartos r
            where r.pedido_id = p.id and r.repartidor_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "pedido_adjuntos: select por almacen" on public.pedido_adjuntos;
create policy "pedido_adjuntos: select por rol" on public.pedido_adjuntos
  for select using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_adjuntos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (
          public.puede_ver_todos_almacenes()
          or p.almacen_id = public.current_almacen_id()
          or exists (
            select 1 from public.repartos r
            where r.pedido_id = p.id and r.repartidor_id = auth.uid()
          )
        )
    )
  );

-- ── repartos: ampliar select/insert/update ─────────────────────────
-- select/update ganan "es el repartidor asignado"; insert (asignar un
-- reparto nuevo) sigue sin esa condición — un repartidor no se auto-asigna.

drop policy if exists "repartos: select por almacen" on public.repartos;
drop policy if exists "repartos: insert por almacen" on public.repartos;
drop policy if exists "repartos: update por almacen" on public.repartos;

create policy "repartos: select por rol" on public.repartos
  for select using (
    repartos.repartidor_id = auth.uid()
    or exists (
      select 1 from public.pedidos p
      where p.id = repartos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or p.almacen_id = public.current_almacen_id())
    )
  );
create policy "repartos: insert por rol" on public.repartos
  for insert with check (
    exists (
      select 1 from public.pedidos p
      where p.id = repartos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or p.almacen_id = public.current_almacen_id())
    )
  );
create policy "repartos: update por rol" on public.repartos
  for update using (
    repartos.repartidor_id = auth.uid()
    or exists (
      select 1 from public.pedidos p
      where p.id = repartos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or p.almacen_id = public.current_almacen_id())
    )
  )
  with check (
    repartos.repartidor_id = auth.uid()
    or exists (
      select 1 from public.pedidos p
      where p.id = repartos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or p.almacen_id = public.current_almacen_id())
    )
  );

-- ── traslados / traslado_detalle: logística ve y opera en todos ────

drop policy if exists "traslados: select por almacen" on public.traslados;
drop policy if exists "traslados: insert por almacen" on public.traslados;
create policy "traslados: select por rol" on public.traslados
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or almacen_origen_id = public.current_almacen_id()
      or almacen_destino_id = public.current_almacen_id()
    )
  );
create policy "traslados: insert por rol" on public.traslados
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or almacen_origen_id = public.current_almacen_id()
      or almacen_destino_id = public.current_almacen_id()
    )
  );

drop policy if exists "traslado_detalle: select por almacen" on public.traslado_detalle;
drop policy if exists "traslado_detalle: insert por almacen" on public.traslado_detalle;
create policy "traslado_detalle: select por rol" on public.traslado_detalle
  for select using (
    exists (
      select 1 from public.traslados t
      where t.id = traslado_detalle.traslado_id
        and t.empresa_id = public.current_empresa_id()
        and (
          public.puede_ver_todos_almacenes()
          or t.almacen_origen_id = public.current_almacen_id()
          or t.almacen_destino_id = public.current_almacen_id()
        )
    )
  );
create policy "traslado_detalle: insert por rol" on public.traslado_detalle
  for insert with check (
    exists (
      select 1 from public.traslados t
      where t.id = traslado_detalle.traslado_id
        and t.empresa_id = public.current_empresa_id()
        and (
          public.puede_ver_todos_almacenes()
          or t.almacen_origen_id = public.current_almacen_id()
          or t.almacen_destino_id = public.current_almacen_id()
        )
    )
  );

-- ── abastecimientos_campo / detalle: logística ve y opera en todos ─

drop policy if exists "abastecimientos_campo: select por almacen" on public.abastecimientos_campo;
drop policy if exists "abastecimientos_campo: insert por almacen" on public.abastecimientos_campo;
create policy "abastecimientos_campo: select por rol" on public.abastecimientos_campo
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );
create policy "abastecimientos_campo: insert por rol" on public.abastecimientos_campo
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );

drop policy if exists "abastecimiento_campo_detalle: select por almacen" on public.abastecimiento_campo_detalle;
drop policy if exists "abastecimiento_campo_detalle: insert por almacen" on public.abastecimiento_campo_detalle;
create policy "abastecimiento_campo_detalle: select por rol" on public.abastecimiento_campo_detalle
  for select using (
    exists (
      select 1 from public.abastecimientos_campo a
      where a.id = abastecimiento_campo_detalle.abastecimiento_id
        and a.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or a.almacen_id = public.current_almacen_id())
    )
  );
create policy "abastecimiento_campo_detalle: insert por rol" on public.abastecimiento_campo_detalle
  for insert with check (
    exists (
      select 1 from public.abastecimientos_campo a
      where a.id = abastecimiento_campo_detalle.abastecimiento_id
        and a.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or a.almacen_id = public.current_almacen_id())
    )
  );

-- ── inventario / kardex_movimientos: logística ve y opera en todos ─

drop policy if exists "inventario: select por almacen" on public.inventario;
drop policy if exists "inventario: insert por almacen" on public.inventario;
drop policy if exists "inventario: update por almacen" on public.inventario;
create policy "inventario: select por rol" on public.inventario
  for select using (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or a.id = public.current_almacen_id())
    )
  );
create policy "inventario: insert por rol" on public.inventario
  for insert with check (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or a.id = public.current_almacen_id())
    )
  );
create policy "inventario: update por rol" on public.inventario
  for update using (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or a.id = public.current_almacen_id())
    )
  )
  with check (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or a.id = public.current_almacen_id())
    )
  );

drop policy if exists "kardex_movimientos: select por almacen" on public.kardex_movimientos;
drop policy if exists "kardex_movimientos: insert por almacen" on public.kardex_movimientos;
create policy "kardex_movimientos: select por rol" on public.kardex_movimientos
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );
create policy "kardex_movimientos: insert por rol" on public.kardex_movimientos
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );
