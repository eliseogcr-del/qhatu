-- Traslados entre almacenes: cubre el flujo de "almacén en tránsito" de un
-- vendedor de campo — carga inicial (almacén principal → almacén móvil del
-- vendedor) y retorno de lo no vendido (almacén móvil → almacén principal).
-- Cada traslado genera dos movimientos de kardex (salida en origen, entrada
-- en destino) que nunca se registran por separado, para que nunca queden
-- descuadrados entre sí.

create table public.traslados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  almacen_origen_id uuid not null references public.almacenes (id),
  almacen_destino_id uuid not null references public.almacenes (id),
  fecha timestamptz not null default now(),
  usuario_id uuid not null references public.usuarios (id),
  nota text,
  created_at timestamptz not null default now(),
  check (almacen_origen_id <> almacen_destino_id)
);

create table public.traslado_detalle (
  id uuid primary key default gen_random_uuid(),
  traslado_id uuid not null references public.traslados (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad numeric(12, 2) not null check (cantidad > 0)
);

alter table public.traslados enable row level security;
alter table public.traslado_detalle enable row level security;

-- Un vendedor solo puede ver/crear traslados donde su propio almacén es el
-- origen o el destino (ej. su carga inicial o su retorno); el admin ve y
-- crea cualquiera. Mismo patrón que el resto de tablas de movimiento.
create policy "traslados: select por almacen" on public.traslados
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or almacen_origen_id = public.current_almacen_id()
      or almacen_destino_id = public.current_almacen_id()
    )
  );
create policy "traslados: insert por almacen" on public.traslados
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.es_admin()
      or almacen_origen_id = public.current_almacen_id()
      or almacen_destino_id = public.current_almacen_id()
    )
  );

create policy "traslado_detalle: select por almacen" on public.traslado_detalle
  for select using (
    exists (
      select 1 from public.traslados t
      where t.id = traslado_detalle.traslado_id
        and t.empresa_id = public.current_empresa_id()
        and (
          public.es_admin()
          or t.almacen_origen_id = public.current_almacen_id()
          or t.almacen_destino_id = public.current_almacen_id()
        )
    )
  );
create policy "traslado_detalle: insert por almacen" on public.traslado_detalle
  for insert with check (
    exists (
      select 1 from public.traslados t
      where t.id = traslado_detalle.traslado_id
        and t.empresa_id = public.current_empresa_id()
        and (
          public.es_admin()
          or t.almacen_origen_id = public.current_almacen_id()
          or t.almacen_destino_id = public.current_almacen_id()
        )
    )
  );

grant select, insert on public.traslados to authenticated;
grant select, insert on public.traslado_detalle to authenticated;

create index if not exists idx_traslados_empresa_id on public.traslados (empresa_id);
create index if not exists idx_traslados_almacen_origen_id on public.traslados (almacen_origen_id);
create index if not exists idx_traslados_almacen_destino_id on public.traslados (almacen_destino_id);
create index if not exists idx_traslado_detalle_traslado_id on public.traslado_detalle (traslado_id);

-- El lado "ajeno" de un traslado (ej. la salida del almacén principal
-- cuando quien registra es un vendedor cuyo almacén fijo es el destino) no
-- se puede expresar con una policy limpia sobre inventario (es un saldo
-- corriente sin referencia a qué operación lo tocó, no un evento con
-- almacen_id propio verificable contra el traslado). Por eso esos dos
-- movimientos se escriben con el cliente admin (service_role) desde la
-- server action, después de validar en código que quien llama es admin o
-- es dueño del almacén origen/destino — igual de seguro, solo que la
-- autorización vive en la action en vez de en la policy.
grant select, insert on public.kardex_movimientos to service_role;
grant select, insert, update on public.inventario to service_role;
