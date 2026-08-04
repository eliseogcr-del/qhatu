-- Módulo de auditoría para ventas y cobranzas: registro inmutable de
-- quién editó/anuló qué, cuándo, y con qué detalle (producto, cantidad,
-- precio, monto). Solo lectura para usuarios con rol = 'admin'.

alter table public.cobranzas
  add column if not exists estado text not null default 'activa';
-- 'activa' | 'anulada'. Nunca se borra una cobranza — anularla la excluye
-- del saldo cobrado pero conserva el registro para trazabilidad.

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  usuario_id uuid not null references public.usuarios (id),
  fecha timestamptz not null default now(),
  entidad text not null,
  entidad_id uuid not null,
  tipo_movimiento text not null,
  producto_id uuid references public.productos (id),
  producto_nombre text,
  cantidad numeric(12, 2),
  precio_unitario numeric(12, 2),
  monto numeric(12, 2),
  detalle text
);

alter table public.auditoria enable row level security;

-- Solo administradores pueden leer el log de auditoría.
create policy "auditoria: select solo admin" on public.auditoria
  for select using (
    empresa_id = public.current_empresa_id()
    and exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol = 'admin'
    )
  );

-- Cualquier usuario autenticado de la empresa puede insertar (queda
-- registrado con su propio usuario_id) — no hay policy de update/delete:
-- el log es estrictamente inmutable, igual que el kardex.
create policy "auditoria: insert por empresa" on public.auditoria
  for insert with check (empresa_id = public.current_empresa_id());

grant select, insert on public.auditoria to authenticated;
