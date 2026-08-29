-- Abastecimiento en campo suma stock al momento (ya afecta kardex), pero
-- nunca capturaba costo -- el vendedor solo registra qué y cuánto. Para
-- que quede reflejado en compras/cuentas por pagar sin volver a tocar el
-- kardex (el stock ya se sumó al crear el abastecimiento), cada
-- abastecimiento con proveedor genera ahora una compra "espejo"
-- (origen='abastecimiento_campo', validado=false), valorizada con
-- productos.costo_referencial. Admin o Logística la revisa/corrige
-- (cantidades e importes) y la valida. Las compras registradas a mano
-- (origen='manual', el flujo que ya existía) siguen afectando el kardex
-- directamente al crearse, sin cambios -- nunca se duplican.

alter table public.compras add column origen text not null default 'manual';
alter table public.compras add column validado boolean not null default true;
alter table public.compras add column abastecimiento_id uuid references public.abastecimientos_campo (id);

create index if not exists idx_compras_abastecimiento_id on public.compras (abastecimiento_id);

-- ── RLS: compras / compra_detalle / pagos_proveedor ────────────────────
-- Logística gana acceso (antes solo lo veía Admin) para poder validar lo
-- que genera Abastecimiento en campo -- mismo criterio que ya usan
-- traslados/abastecimiento_campo/inventario/kardex/repartos.

drop policy if exists "compras: select por almacen" on public.compras;
drop policy if exists "compras: insert por almacen" on public.compras;
drop policy if exists "compras: update por almacen" on public.compras;

create policy "compras: select por rol" on public.compras
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );
create policy "compras: insert por rol" on public.compras
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );
create policy "compras: update por rol" on public.compras
  for update using (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (public.puede_ver_todos_almacenes() or almacen_id = public.current_almacen_id())
  );

drop policy if exists "compra_detalle: select por almacen" on public.compra_detalle;
drop policy if exists "compra_detalle: insert por almacen" on public.compra_detalle;

create policy "compra_detalle: select por rol" on public.compra_detalle
  for select using (
    exists (
      select 1 from public.compras c
      where c.id = compra_detalle.compra_id
        and c.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or c.almacen_id = public.current_almacen_id())
    )
  );
create policy "compra_detalle: insert por rol" on public.compra_detalle
  for insert with check (
    exists (
      select 1 from public.compras c
      where c.id = compra_detalle.compra_id
        and c.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or c.almacen_id = public.current_almacen_id())
    )
  );
-- Nueva: no existía ninguna forma de corregir cantidad/costo -- hace
-- falta para poder validar (y ajustar) lo que llega desde abastecimiento.
create policy "compra_detalle: update por rol" on public.compra_detalle
  for update using (
    exists (
      select 1 from public.compras c
      where c.id = compra_detalle.compra_id
        and c.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or c.almacen_id = public.current_almacen_id())
    )
  )
  with check (
    exists (
      select 1 from public.compras c
      where c.id = compra_detalle.compra_id
        and c.empresa_id = public.current_empresa_id()
        and (public.puede_ver_todos_almacenes() or c.almacen_id = public.current_almacen_id())
    )
  );

grant update on public.compra_detalle to authenticated;

drop policy if exists "pagos_proveedor: select por almacen" on public.pagos_proveedor;
drop policy if exists "pagos_proveedor: insert por almacen" on public.pagos_proveedor;
drop policy if exists "pagos_proveedor: update por almacen" on public.pagos_proveedor;

create policy "pagos_proveedor: select por rol" on public.pagos_proveedor
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.compras c
        where c.id = pagos_proveedor.compra_id and c.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "pagos_proveedor: insert por rol" on public.pagos_proveedor
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.compras c
        where c.id = pagos_proveedor.compra_id and c.almacen_id = public.current_almacen_id()
      )
    )
  );
create policy "pagos_proveedor: update por rol" on public.pagos_proveedor
  for update using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.compras c
        where c.id = pagos_proveedor.compra_id and c.almacen_id = public.current_almacen_id()
      )
    )
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or exists (
        select 1 from public.compras c
        where c.id = pagos_proveedor.compra_id and c.almacen_id = public.current_almacen_id()
      )
    )
  );
