-- Producción: lo que la propia empresa elabora en su almacén (no es una
-- compra a proveedor ni algo que un vendedor recoge en ruta) -- suma
-- directo al inventario del almacén elegido y genera un movimiento de
-- kardex tipo "produccion". Solo admin/logística lo usan; cualquiera de
-- los dos puede registrar producción en cualquier almacén (no hay uno
-- fijo por rol acá, a diferencia de vendedor).

create table public.producciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  almacen_id uuid not null references public.almacenes (id),
  fecha timestamptz not null default now(),
  usuario_id uuid not null references public.usuarios (id),
  nota text,
  created_at timestamptz not null default now()
);

create table public.produccion_detalle (
  id uuid primary key default gen_random_uuid(),
  produccion_id uuid not null references public.producciones (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad numeric(12, 2) not null check (cantidad > 0)
);

alter table public.producciones enable row level security;
alter table public.produccion_detalle enable row level security;

-- A diferencia de abastecimiento_campo (un solo almacén, el del vendedor),
-- acá se usa puede_ver_todos_almacenes() directamente: no hay fallback a
-- current_almacen_id() porque ningún vendedor/repartidor debe ver ni tocar
-- este módulo, tenga o no almacén fijo.
create policy "producciones: select admin/logistica" on public.producciones
  for select using (
    empresa_id = public.current_empresa_id() and public.puede_ver_todos_almacenes()
  );
create policy "producciones: insert admin/logistica" on public.producciones
  for insert with check (
    empresa_id = public.current_empresa_id() and public.puede_ver_todos_almacenes()
  );
-- Update habilitado (a diferencia de compras/abastecimiento) porque este
-- módulo permite corregir cantidad/producto después de guardado; el
-- kardex en sí sigue siendo inmutable -- una corrección inserta un
-- movimiento de ajuste nuevo, nunca reescribe uno existente.
create policy "producciones: update admin/logistica" on public.producciones
  for update using (
    empresa_id = public.current_empresa_id() and public.puede_ver_todos_almacenes()
  )
  with check (
    empresa_id = public.current_empresa_id() and public.puede_ver_todos_almacenes()
  );

create policy "produccion_detalle: select admin/logistica" on public.produccion_detalle
  for select using (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and public.puede_ver_todos_almacenes()
    )
  );
create policy "produccion_detalle: insert admin/logistica" on public.produccion_detalle
  for insert with check (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and public.puede_ver_todos_almacenes()
    )
  );
create policy "produccion_detalle: update admin/logistica" on public.produccion_detalle
  for update using (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and public.puede_ver_todos_almacenes()
    )
  )
  with check (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and public.puede_ver_todos_almacenes()
    )
  );
create policy "produccion_detalle: delete admin/logistica" on public.produccion_detalle
  for delete using (
    exists (
      select 1 from public.producciones p
      where p.id = produccion_detalle.produccion_id
        and p.empresa_id = public.current_empresa_id()
        and public.puede_ver_todos_almacenes()
    )
  );

grant select, insert, update on public.producciones to authenticated;
grant select, insert, update, delete on public.produccion_detalle to authenticated;

create index if not exists idx_producciones_empresa_id on public.producciones (empresa_id);
create index if not exists idx_producciones_almacen_id on public.producciones (almacen_id);
create index if not exists idx_produccion_detalle_produccion_id on public.produccion_detalle (produccion_id);
