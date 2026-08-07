-- Soporte para múltiples locales/almacenes con visibilidad restringida:
-- cada usuario (salvo admin) queda amarrado a un almacén; sus pedidos,
-- ventas y compras quedan etiquetados con ese almacén; y el resto de
-- tablas relacionadas (detalle, cobranzas, comprobantes, repartos,
-- inventario, kardex) solo son visibles para quien pertenece a ese
-- almacén. Admin (almacen_id null) sigue viendo y operando en todos.

-- ── Columnas nuevas (antes de las funciones: las funciones SQL se
-- validan contra el esquema en el momento de crearse, así que la
-- columna almacen_id debe existir primero) ─────────────────────────

alter table public.usuarios add column if not exists almacen_id uuid references public.almacenes (id);
alter table public.pedidos add column if not exists almacen_id uuid references public.almacenes (id);
alter table public.ventas add column if not exists almacen_id uuid references public.almacenes (id);
alter table public.compras add column if not exists almacen_id uuid references public.almacenes (id);

-- ── Funciones helper (mismo patrón que current_empresa_id) ────────────

create or replace function public.current_almacen_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select almacen_id from public.usuarios where id = auth.uid()
$$;

create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(rol = 'admin', false) from public.usuarios where id = auth.uid()
$$;

-- ── Backfill ────────────────────────────────────────────────────────

-- Vendedores existentes: se les asigna el primer almacén de su empresa
-- para no dejarlos sin ver nada de un día para otro. El admin puede
-- reasignarlos a otro local desde Usuarios cuando corresponda. Los
-- admin quedan con almacen_id null a propósito (= "todos los locales").
update public.usuarios u
set almacen_id = (
  select a.id from public.almacenes a
  where a.empresa_id = u.empresa_id
  order by a.created_at
  limit 1
)
where u.almacen_id is null and u.rol <> 'admin';

update public.pedidos p
set almacen_id = (
  select a.id from public.almacenes a
  where a.empresa_id = p.empresa_id
  order by a.created_at
  limit 1
)
where p.almacen_id is null;

update public.ventas v
set almacen_id = (
  select p.almacen_id from public.pedidos p where p.id = v.pedido_id
)
where v.almacen_id is null;

update public.compras c
set almacen_id = (
  select a.id from public.almacenes a
  where a.empresa_id = c.empresa_id
  order by a.created_at
  limit 1
)
where c.almacen_id is null;

alter table public.pedidos alter column almacen_id set not null;
alter table public.ventas alter column almacen_id set not null;
alter table public.compras alter column almacen_id set not null;

create index if not exists idx_usuarios_almacen_id on public.usuarios (almacen_id);
create index if not exists idx_pedidos_almacen_id on public.pedidos (almacen_id);
create index if not exists idx_ventas_almacen_id on public.ventas (almacen_id);
create index if not exists idx_compras_almacen_id on public.compras (almacen_id);

-- ── RLS: pedidos ────────────────────────────────────────────────────

drop policy if exists "pedidos: select por empresa" on public.pedidos;
drop policy if exists "pedidos: insert por empresa" on public.pedidos;
drop policy if exists "pedidos: update por empresa" on public.pedidos;

create policy "pedidos: select por almacen" on public.pedidos
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );
create policy "pedidos: insert por almacen" on public.pedidos
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );
create policy "pedidos: update por almacen" on public.pedidos
  for update using (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );

-- ── RLS: pedido_detalle / pedido_adjuntos (join a pedidos) ─────────

drop policy if exists "pedido_detalle: select por empresa" on public.pedido_detalle;
drop policy if exists "pedido_detalle: insert por empresa" on public.pedido_detalle;

create policy "pedido_detalle: select por almacen" on public.pedido_detalle
  for select using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_detalle.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.es_admin() or p.almacen_id = public.current_almacen_id())
    )
  );
create policy "pedido_detalle: insert por almacen" on public.pedido_detalle
  for insert with check (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_detalle.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.es_admin() or p.almacen_id = public.current_almacen_id())
    )
  );

drop policy if exists "pedido_adjuntos: select por empresa" on public.pedido_adjuntos;
drop policy if exists "pedido_adjuntos: insert por empresa" on public.pedido_adjuntos;

create policy "pedido_adjuntos: select por almacen" on public.pedido_adjuntos
  for select using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_adjuntos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.es_admin() or p.almacen_id = public.current_almacen_id())
    )
  );
create policy "pedido_adjuntos: insert por almacen" on public.pedido_adjuntos
  for insert with check (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_adjuntos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.es_admin() or p.almacen_id = public.current_almacen_id())
    )
  );

-- ── RLS: repartos (join a pedidos) ─────────────────────────────────

drop policy if exists "repartos: select por empresa" on public.repartos;
drop policy if exists "repartos: insert por empresa" on public.repartos;
drop policy if exists "repartos: update por empresa" on public.repartos;

create policy "repartos: select por almacen" on public.repartos
  for select using (
    exists (
      select 1 from public.pedidos p
      where p.id = repartos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.es_admin() or p.almacen_id = public.current_almacen_id())
    )
  );
create policy "repartos: insert por almacen" on public.repartos
  for insert with check (
    exists (
      select 1 from public.pedidos p
      where p.id = repartos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.es_admin() or p.almacen_id = public.current_almacen_id())
    )
  );
create policy "repartos: update por almacen" on public.repartos
  for update using (
    exists (
      select 1 from public.pedidos p
      where p.id = repartos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.es_admin() or p.almacen_id = public.current_almacen_id())
    )
  )
  with check (
    exists (
      select 1 from public.pedidos p
      where p.id = repartos.pedido_id
        and p.empresa_id = public.current_empresa_id()
        and (public.es_admin() or p.almacen_id = public.current_almacen_id())
    )
  );

-- ── RLS: ventas ─────────────────────────────────────────────────────

drop policy if exists "ventas: select por empresa" on public.ventas;
drop policy if exists "ventas: insert por empresa" on public.ventas;
drop policy if exists "ventas: update por empresa" on public.ventas;

create policy "ventas: select por almacen" on public.ventas
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );
create policy "ventas: insert por almacen" on public.ventas
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );
create policy "ventas: update por almacen" on public.ventas
  for update using (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );

-- ── RLS: venta_detalle / devoluciones (join a ventas) ──────────────

drop policy if exists "venta_detalle: select por empresa" on public.venta_detalle;
drop policy if exists "venta_detalle: insert por empresa" on public.venta_detalle;

create policy "venta_detalle: select por almacen" on public.venta_detalle
  for select using (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
        and (public.es_admin() or v.almacen_id = public.current_almacen_id())
    )
  );
create policy "venta_detalle: insert por almacen" on public.venta_detalle
  for insert with check (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
        and (public.es_admin() or v.almacen_id = public.current_almacen_id())
    )
  );

drop policy if exists "devoluciones: select por empresa" on public.devoluciones;
drop policy if exists "devoluciones: insert por empresa" on public.devoluciones;

create policy "devoluciones: select por almacen" on public.devoluciones
  for select using (
    exists (
      select 1 from public.venta_detalle vd
      join public.ventas v on v.id = vd.venta_id
      where vd.id = devoluciones.venta_detalle_id
        and v.empresa_id = public.current_empresa_id()
        and (public.es_admin() or v.almacen_id = public.current_almacen_id())
    )
  );
create policy "devoluciones: insert por almacen" on public.devoluciones
  for insert with check (
    exists (
      select 1 from public.venta_detalle vd
      join public.ventas v on v.id = vd.venta_id
      where vd.id = devoluciones.venta_detalle_id
        and v.empresa_id = public.current_empresa_id()
        and (public.es_admin() or v.almacen_id = public.current_almacen_id())
    )
  );

-- ── RLS: cobranzas (join a pedidos — pedido_id nunca es null) ──────

drop policy if exists "cobranzas: select por empresa" on public.cobranzas;
drop policy if exists "cobranzas: insert por empresa" on public.cobranzas;
drop policy if exists "cobranzas: update por empresa" on public.cobranzas;

create policy "cobranzas: select por almacen" on public.cobranzas
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.pedidos p
        where p.id = cobranzas.pedido_id and p.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "cobranzas: insert por almacen" on public.cobranzas
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.pedidos p
        where p.id = cobranzas.pedido_id and p.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "cobranzas: update por almacen" on public.cobranzas
  for update using (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.pedidos p
        where p.id = cobranzas.pedido_id and p.almacen_id = public.current_almacen_id()
      )
    )
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.pedidos p
        where p.id = cobranzas.pedido_id and p.almacen_id = public.current_almacen_id()
      )
    )
  );

-- ── RLS: comprobantes (join a ventas) ──────────────────────────────

drop policy if exists "comprobantes: select por empresa" on public.comprobantes;
drop policy if exists "comprobantes: insert por empresa" on public.comprobantes;
drop policy if exists "comprobantes: update por empresa" on public.comprobantes;

create policy "comprobantes: select por almacen" on public.comprobantes
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "comprobantes: insert por almacen" on public.comprobantes
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "comprobantes: update por almacen" on public.comprobantes
  for update using (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );

-- ── RLS: compras ────────────────────────────────────────────────────

drop policy if exists "compras: select por empresa" on public.compras;
drop policy if exists "compras: insert por empresa" on public.compras;
drop policy if exists "compras: update por empresa" on public.compras;

create policy "compras: select por almacen" on public.compras
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );
create policy "compras: insert por almacen" on public.compras
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );
create policy "compras: update por almacen" on public.compras
  for update using (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );

-- ── RLS: compra_detalle / pagos_proveedor (join a compras) ─────────

drop policy if exists "compra_detalle: select por empresa" on public.compra_detalle;
drop policy if exists "compra_detalle: insert por empresa" on public.compra_detalle;

create policy "compra_detalle: select por almacen" on public.compra_detalle
  for select using (
    exists (
      select 1 from public.compras c
      where c.id = compra_detalle.compra_id
        and c.empresa_id = public.current_empresa_id()
        and (public.es_admin() or c.almacen_id = public.current_almacen_id())
    )
  );
create policy "compra_detalle: insert por almacen" on public.compra_detalle
  for insert with check (
    exists (
      select 1 from public.compras c
      where c.id = compra_detalle.compra_id
        and c.empresa_id = public.current_empresa_id()
        and (public.es_admin() or c.almacen_id = public.current_almacen_id())
    )
  );

drop policy if exists "pagos_proveedor: select por empresa" on public.pagos_proveedor;
drop policy if exists "pagos_proveedor: insert por empresa" on public.pagos_proveedor;
drop policy if exists "pagos_proveedor: update por empresa" on public.pagos_proveedor;

create policy "pagos_proveedor: select por almacen" on public.pagos_proveedor
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.compras c
        where c.id = pagos_proveedor.compra_id and c.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "pagos_proveedor: insert por almacen" on public.pagos_proveedor
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.compras c
        where c.id = pagos_proveedor.compra_id and c.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "pagos_proveedor: update por almacen" on public.pagos_proveedor
  for update using (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.compras c
        where c.id = pagos_proveedor.compra_id and c.almacen_id = public.current_almacen_id()
      )
    )
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or exists (
        select 1 from public.compras c
        where c.id = pagos_proveedor.compra_id and c.almacen_id = public.current_almacen_id()
      )
    )
  );

-- ── RLS: inventario / kardex_movimientos (ya tienen almacen_id) ────

drop policy if exists "inventario: select por empresa" on public.inventario;
drop policy if exists "inventario: insert por empresa" on public.inventario;
drop policy if exists "inventario: update por empresa" on public.inventario;

create policy "inventario: select por almacen" on public.inventario
  for select using (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
        and (public.es_admin() or a.id = public.current_almacen_id())
    )
  );
create policy "inventario: insert por almacen" on public.inventario
  for insert with check (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
        and (public.es_admin() or a.id = public.current_almacen_id())
    )
  );
create policy "inventario: update por almacen" on public.inventario
  for update using (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
        and (public.es_admin() or a.id = public.current_almacen_id())
    )
  )
  with check (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
        and (public.es_admin() or a.id = public.current_almacen_id())
    )
  );

drop policy if exists "kardex_movimientos: select por empresa" on public.kardex_movimientos;
drop policy if exists "kardex_movimientos: insert por empresa" on public.kardex_movimientos;

create policy "kardex_movimientos: select por almacen" on public.kardex_movimientos
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );
create policy "kardex_movimientos: insert por almacen" on public.kardex_movimientos
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );

-- ── Almacenes: gestión solo para admin (antes cualquier usuario podía
-- crear/editar) — ahora que define a qué local pertenece cada quien,
-- solo el admin debe poder darlos de alta o modificarlos. La lectura
-- se mantiene abierta a toda la empresa (todos necesitan ver la lista
-- para, por ejemplo, el selector de local al registrar una compra).

drop policy if exists "almacenes: insert por empresa" on public.almacenes;
drop policy if exists "almacenes: update por empresa" on public.almacenes;

create policy "almacenes: insert solo admin" on public.almacenes
  for insert with check (
    empresa_id = public.current_empresa_id() and public.es_admin()
  );
create policy "almacenes: update solo admin" on public.almacenes
  for update using (
    empresa_id = public.current_empresa_id() and public.es_admin()
  )
  with check (empresa_id = public.current_empresa_id());

-- ── Usuarios: solo admin puede reasignar el almacen_id de otros ────
-- (la policy de update ya existente en usuarios se maneja vía
-- service_role desde las server actions de /usuarios, no hace falta
-- tocarla acá).
