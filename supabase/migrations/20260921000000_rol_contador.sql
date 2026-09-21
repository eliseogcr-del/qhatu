-- Nuevo rol "contador": solo necesita ver comprobantes electrónicos
-- (boletas, facturas, notas de venta/crédito/débito) de TODA la empresa,
-- sin importar el almacén — a diferencia de vendedor/produccion, que
-- están atados a su propio almacen_id. Se agrega una función dedicada
-- es_contador() (no se reutiliza puede_ver_todos_almacenes(), que también
-- abre pedidos/traslados/inventario/kardex/repartos — mucho más de lo que
-- este rol debe ver) y se extiende con ella únicamente:
--   - comprobantes: select (lo que lista el módulo)
--   - ventas: select (join embebido en la consulta de comprobantes para
--     mostrar cliente/total — sin esto, la fila del comprobante se ve
--     pero el nombre del cliente y el total salen en "—")

create or replace function public.es_contador()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(rol = 'contador', false) from public.usuarios where id = auth.uid()
$$;

-- ── comprobantes ────────────────────────────────────────────────────

drop policy if exists "comprobantes: select por rol" on public.comprobantes;
create policy "comprobantes: select por rol" on public.comprobantes
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or public.es_contador()
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );

-- ── ventas (solo select — el contador no crea ni edita ventas) ─────

drop policy if exists "ventas: select por rol" on public.ventas;
create policy "ventas: select por rol" on public.ventas
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or public.es_contador()
      or almacen_id = public.current_almacen_id()
    )
  );
