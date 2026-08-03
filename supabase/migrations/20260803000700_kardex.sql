-- Módulo 8 (final del MVP): almacenes, inventario y kardex_movimientos.
-- kardex_movimientos es el registro inmutable de todo movimiento de
-- stock (compra/venta/ajuste/merma) — solo se genera para productos con
-- control_inventario = true. inventario es el saldo vigente derivado de
-- ese ledger (se mantiene en cada insert, nunca se edita a mano).

create table public.almacenes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  nombre text not null,
  direccion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventario (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id),
  almacen_id uuid not null references public.almacenes (id),
  stock_actual numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (producto_id, almacen_id)
);

create table public.kardex_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  producto_id uuid not null references public.productos (id),
  almacen_id uuid not null references public.almacenes (id),
  tipo_movimiento text not null,
  cantidad numeric(12, 2) not null,
  saldo_resultante numeric(12, 2) not null,
  fecha timestamptz not null default now(),
  referencia_id uuid,
  usuario_id uuid not null references public.usuarios (id)
);

alter table public.almacenes enable row level security;
alter table public.inventario enable row level security;
alter table public.kardex_movimientos enable row level security;

create policy "almacenes: select por empresa" on public.almacenes
  for select using (empresa_id = public.current_empresa_id());
create policy "almacenes: insert por empresa" on public.almacenes
  for insert with check (empresa_id = public.current_empresa_id());
create policy "almacenes: update por empresa" on public.almacenes
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy "inventario: select por empresa" on public.inventario
  for select using (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
    )
  );
create policy "inventario: insert por empresa" on public.inventario
  for insert with check (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
    )
  );
create policy "inventario: update por empresa" on public.inventario
  for update using (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
    )
  )
  with check (
    exists (
      select 1 from public.almacenes a
      where a.id = inventario.almacen_id
        and a.empresa_id = public.current_empresa_id()
    )
  );

create policy "kardex_movimientos: select por empresa" on public.kardex_movimientos
  for select using (empresa_id = public.current_empresa_id());
create policy "kardex_movimientos: insert por empresa" on public.kardex_movimientos
  for insert with check (empresa_id = public.current_empresa_id());

-- Sin policy de update/delete: el kardex es estrictamente inmutable.

grant select, insert, update on public.almacenes to authenticated;
grant select, insert, update on public.inventario to authenticated;
grant select, insert on public.kardex_movimientos to authenticated;

-- Bootstrap: almacén principal para la empresa ya sembrada.
insert into public.almacenes (empresa_id, nombre)
select id, 'Almacén principal' from public.empresas limit 1;
