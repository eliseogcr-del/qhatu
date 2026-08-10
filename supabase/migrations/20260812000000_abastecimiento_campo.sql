-- Abastecimiento en campo: el vendedor recoge mercadería directamente de
-- un proveedor mientras está en ruta, sin manejar precios ni documentos de
-- compra — solo registra qué producto y cuánta cantidad recogió, y suma de
-- inmediato a su almacén móvil. Es deliberadamente distinto de "compras"
-- (que sí lleva costo y cuentas por pagar al proveedor): contabilidad
-- puede cruzar esto después contra la factura real cuando llegue, usando
-- proveedor_id como referencia.

create table public.abastecimientos_campo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  almacen_id uuid not null references public.almacenes (id),
  proveedor_id uuid references public.proveedores (id),
  fecha timestamptz not null default now(),
  usuario_id uuid not null references public.usuarios (id),
  nota text,
  created_at timestamptz not null default now()
);

create table public.abastecimiento_campo_detalle (
  id uuid primary key default gen_random_uuid(),
  abastecimiento_id uuid not null references public.abastecimientos_campo (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad numeric(12, 2) not null check (cantidad > 0)
);

alter table public.abastecimientos_campo enable row level security;
alter table public.abastecimiento_campo_detalle enable row level security;

-- A diferencia de traslados, acá solo hay un almacén involucrado (el
-- propio del vendedor) así que la policy normal alcanza sin necesitar
-- service_role para los movimientos de kardex/inventario derivados.
create policy "abastecimientos_campo: select por almacen" on public.abastecimientos_campo
  for select using (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );
create policy "abastecimientos_campo: insert por almacen" on public.abastecimientos_campo
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (public.es_admin() or almacen_id = public.current_almacen_id())
  );

create policy "abastecimiento_campo_detalle: select por almacen" on public.abastecimiento_campo_detalle
  for select using (
    exists (
      select 1 from public.abastecimientos_campo a
      where a.id = abastecimiento_campo_detalle.abastecimiento_id
        and a.empresa_id = public.current_empresa_id()
        and (public.es_admin() or a.almacen_id = public.current_almacen_id())
    )
  );
create policy "abastecimiento_campo_detalle: insert por almacen" on public.abastecimiento_campo_detalle
  for insert with check (
    exists (
      select 1 from public.abastecimientos_campo a
      where a.id = abastecimiento_campo_detalle.abastecimiento_id
        and a.empresa_id = public.current_empresa_id()
        and (public.es_admin() or a.almacen_id = public.current_almacen_id())
    )
  );

grant select, insert on public.abastecimientos_campo to authenticated;
grant select, insert on public.abastecimiento_campo_detalle to authenticated;

create index if not exists idx_abastecimientos_campo_empresa_id on public.abastecimientos_campo (empresa_id);
create index if not exists idx_abastecimientos_campo_almacen_id on public.abastecimientos_campo (almacen_id);
create index if not exists idx_abastecimiento_campo_detalle_abastecimiento_id on public.abastecimiento_campo_detalle (abastecimiento_id);
