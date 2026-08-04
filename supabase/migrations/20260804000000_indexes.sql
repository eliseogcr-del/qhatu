-- Postgres auto-indexes primary keys, but not foreign keys. Every table's
-- RLS policy filters by empresa_id (directly or via current_empresa_id()),
-- and several pages join/filter on other FK columns — without indexes,
-- these degrade to sequential scans as tables grow. Cheap now, painful to
-- add later once tables are large (index builds lock/scan the whole table).

-- empresa_id: filtered on every RLS-protected query, on every table that
-- carries it directly.
create index if not exists idx_usuarios_empresa_id on public.usuarios (empresa_id);
create index if not exists idx_clientes_empresa_id on public.clientes (empresa_id);
create index if not exists idx_proveedores_empresa_id on public.proveedores (empresa_id);
create index if not exists idx_productos_empresa_id on public.productos (empresa_id);
create index if not exists idx_pedidos_empresa_id on public.pedidos (empresa_id);
create index if not exists idx_repartos_empresa_id on public.repartos (empresa_id);
create index if not exists idx_ventas_empresa_id on public.ventas (empresa_id);
create index if not exists idx_cobranzas_empresa_id on public.cobranzas (empresa_id);
create index if not exists idx_almacenes_empresa_id on public.almacenes (empresa_id);
create index if not exists idx_kardex_movimientos_empresa_id on public.kardex_movimientos (empresa_id);

-- Other foreign keys used in joins/filters across the app.
create index if not exists idx_productos_proveedor_id on public.productos (proveedor_id);
create index if not exists idx_pedidos_cliente_id on public.pedidos (cliente_id);
create index if not exists idx_pedido_detalle_pedido_id on public.pedido_detalle (pedido_id);
create index if not exists idx_pedido_detalle_producto_id on public.pedido_detalle (producto_id);
create index if not exists idx_pedido_adjuntos_pedido_id on public.pedido_adjuntos (pedido_id);
create index if not exists idx_repartos_pedido_id on public.repartos (pedido_id);
create index if not exists idx_repartos_repartidor_id on public.repartos (repartidor_id);
create index if not exists idx_ventas_pedido_id on public.ventas (pedido_id);
create index if not exists idx_ventas_cliente_id on public.ventas (cliente_id);
create index if not exists idx_venta_detalle_venta_id on public.venta_detalle (venta_id);
create index if not exists idx_venta_detalle_producto_id on public.venta_detalle (producto_id);
create index if not exists idx_devoluciones_venta_detalle_id on public.devoluciones (venta_detalle_id);
create index if not exists idx_cobranzas_pedido_id on public.cobranzas (pedido_id);
create index if not exists idx_cobranzas_venta_id on public.cobranzas (venta_id);
create index if not exists idx_cliente_vendedor_cliente_id on public.cliente_vendedor (cliente_id);
create index if not exists idx_cliente_vendedor_usuario_id on public.cliente_vendedor (usuario_id);
create index if not exists idx_inventario_almacen_id on public.inventario (almacen_id);
create index if not exists idx_kardex_movimientos_producto_id on public.kardex_movimientos (producto_id);
create index if not exists idx_kardex_movimientos_almacen_id on public.kardex_movimientos (almacen_id);

-- Search filters use ILIKE '%term%' (leading wildcard), which a normal
-- btree index can't accelerate — it needs a trigram index instead.
create extension if not exists pg_trgm;

create index if not exists idx_clientes_nombre_trgm on public.clientes using gin (nombre gin_trgm_ops);
create index if not exists idx_productos_nombre_trgm on public.productos using gin (nombre gin_trgm_ops);
create index if not exists idx_proveedores_nombre_trgm on public.proveedores using gin (nombre gin_trgm_ops);

-- Default sort order for the pedidos list/export.
create index if not exists idx_pedidos_fecha on public.pedidos (fecha desc);
