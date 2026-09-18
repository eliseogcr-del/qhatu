-- Promociones: una promoción es un producto "espejo" atado a un producto
-- real (promocion_de_producto_id) — solo se puede vender si ese producto
-- ya está en la misma venta. Reutiliza toda la infraestructura de
-- productos (kardex, precios, combobox) en vez de crear un camino
-- paralelo: precio_campo/precio_digital guardan el monto (negativo, para
-- que reste del total), control_inventario siempre queda en false (no
-- mueve stock), y precio_editable en false (el precio no se toca a mano,
-- es el que se configuró en la promoción).
--
-- activo se deja siempre en false para que las ~30 pantallas que listan
-- productos con `.eq("activo", true)` la ignoren automáticamente sin
-- tocar ninguna de ellas. La visibilidad real vive en promocion_activa,
-- y solo las dos pantallas de Ventas que arman líneas a mano (Venta
-- directa, Editar venta) la agregan explícitamente a la lista.

alter table public.productos
  add column es_promocion boolean not null default false,
  add column promocion_de_producto_id uuid references public.productos (id),
  add column promocion_activa boolean not null default false;

create index if not exists idx_productos_promocion_de_producto_id
  on public.productos (promocion_de_producto_id);
