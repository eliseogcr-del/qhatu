-- El perfil de logística ahora tiene acceso al módulo de Ventas en el
-- menú (ve/registra/cobra ventas de todos los almacenes, igual que
-- admin), pero las políticas RLS de ventas/venta_detalle/devoluciones/
-- cobranzas/comprobantes seguían usando es_admin() en vez de
-- puede_ver_todos_almacenes() (la función que ya usan pedidos, traslados,
-- abastecimientos, inventario y kardex desde el rol logística). Como
-- logística tiene almacen_id null, no calzaba con ningún almacen_id ni
-- con es_admin(), así que veía 0 ventas.

-- ── ventas ──────────────────────────────────────────────────────────

drop policy if exists "ventas: select por almacen" on public.ventas;
drop policy if exists "ventas: insert por almacen" on public.ventas;
drop policy if exists "ventas: update por almacen" on public.ventas;

create policy "ventas: select por rol" on public.ventas
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );
create policy "ventas: insert por rol" on public.ventas
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );
create policy "ventas: update por rol" on public.ventas
  for update using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );

-- ── venta_detalle / devoluciones (join a ventas) ───────────────────

drop policy if exists "venta_detalle: select por almacen" on public.venta_detalle;
drop policy if exists "venta_detalle: insert por almacen" on public.venta_detalle;

create policy "venta_detalle: select por rol" on public.venta_detalle
  for select using (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or v.almacen_id = public.current_almacen_id())
    )
  );
create policy "venta_detalle: insert por rol" on public.venta_detalle
  for insert with check (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or v.almacen_id = public.current_almacen_id())
    )
  );

drop policy if exists "devoluciones: select por almacen" on public.devoluciones;
drop policy if exists "devoluciones: insert por almacen" on public.devoluciones;

create policy "devoluciones: select por rol" on public.devoluciones
  for select using (
    exists (
      select 1 from public.venta_detalle vd
      join public.ventas v on v.id = vd.venta_id
      where vd.id = devoluciones.venta_detalle_id
        and v.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or v.almacen_id = public.current_almacen_id())
    )
  );
create policy "devoluciones: insert por rol" on public.devoluciones
  for insert with check (
    exists (
      select 1 from public.venta_detalle vd
      join public.ventas v on v.id = vd.venta_id
      where vd.id = devoluciones.venta_detalle_id
        and v.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or v.almacen_id = public.current_almacen_id())
    )
  );

-- ── cobranzas (join a pedidos — pedido_id nunca es null) ───────────

drop policy if exists "cobranzas: select por almacen" on public.cobranzas;
drop policy if exists "cobranzas: insert por almacen" on public.cobranzas;
drop policy if exists "cobranzas: update por almacen" on public.cobranzas;

create policy "cobranzas: select por rol" on public.cobranzas
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.pedidos p
        where p.id = cobranzas.pedido_id and p.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "cobranzas: insert por rol" on public.cobranzas
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.pedidos p
        where p.id = cobranzas.pedido_id and p.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "cobranzas: update por rol" on public.cobranzas
  for update using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.pedidos p
        where p.id = cobranzas.pedido_id and p.almacen_id = public.current_almacen_id()
      )
    )
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.pedidos p
        where p.id = cobranzas.pedido_id and p.almacen_id = public.current_almacen_id()
      )
    )
  );

-- ── comprobantes (join a ventas) ────────────────────────────────────

drop policy if exists "comprobantes: select por almacen" on public.comprobantes;
drop policy if exists "comprobantes: insert por almacen" on public.comprobantes;
drop policy if exists "comprobantes: update por almacen" on public.comprobantes;

create policy "comprobantes: select por rol" on public.comprobantes
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "comprobantes: insert por rol" on public.comprobantes
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "comprobantes: update por rol" on public.comprobantes
  for update using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );
