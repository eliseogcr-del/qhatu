-- Ventas y Cotizaciones tenían el % de IGV en dos configuraciones
-- separadas (configuracion_facturacion.porcentaje_igv,
-- configuracion_cotizaciones.porcentaje_igv) — ambas en 10.5% por
-- coincidencia, pero editables por separado, que es justo cómo se
-- desfasaron antes (Ventas se quedó en el 18% viejo mientras Cotizaciones
-- ya estaba en 10.5%). Se unifica en una sola fuente:
-- configuracion_facturacion.porcentaje_igv, la misma que ya usa Ventas.
-- cotizaciones.porcentaje_igv (el valor ya guardado en cada cotización
-- emitida) no se toca — es historial, no configuración.

alter table public.configuracion_cotizaciones
  drop column porcentaje_igv;
