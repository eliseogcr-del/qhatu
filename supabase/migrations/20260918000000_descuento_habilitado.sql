-- El descuento en Ventas ahora es configurable (activar/desactivar),
-- igual que el bloqueo de precios en la misma tabla. Deshabilitado por
-- defecto: el campo "Descuento" no aparece en los formularios y el
-- servidor fuerza el descuento a 0 hasta que un admin lo habilite.

alter table public.configuracion_precios
  add column descuento_habilitado boolean not null default false;
