-- Datos de prueba: catálogo de productos (importado desde producto.xlsx),
-- con su proveedor asociado. Todo se ata a la única empresa ya sembrada.

do $$
declare
  v_empresa_id uuid;
begin
  select id into v_empresa_id from public.empresas limit 1;

  insert into public.proveedores (empresa_id, nombre)
  select v_empresa_id, 'MAZZINI'
  where not exists (
    select 1 from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'
  );

  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'SANDWIICH DE POLLO', null, 'GRIMANA FOOD', 'SANDWICHES', null,
    null, null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'SANDWIICH DE POLLO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ PIÑA BAJO', null, 'GRIMANA FOOD', 'PANIFICADOS', 'QUEQUES',
    'PIÑA BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 3, 'Gravado', 'IGV 18%', 'MEDIBLE',
    true, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ PIÑA BAJO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TAJADA DE QUEQUE SABORES ESPECIALES', null, 'GRIMANA FOOD', 'POSTRES Y PASTELERIA', 'QUEQUES ESPECIALES',
    null, (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    true, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TAJADA DE QUEQUE SABORES ESPECIALES'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'MINITRIPLE BOCADITO (TRIANGULO) TRADICIONAL', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    null, null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    true, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'MINITRIPLE BOCADITO (TRIANGULO) TRADICIONAL'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'MINITRIPLE BOCADITO (CUADRADO) TRADICIONAL', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    null, null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    true, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'MINITRIPLE BOCADITO (CUADRADO) TRADICIONAL'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'LECHE ASADA UNIDAD', null, null, 'POSTRES Y PASTELERIA', 'POSTRES AL HORNO',
    'LECHE ASADA', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 12, 'Gravado', 'IGV 18%', 'MEDIBLE',
    true, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'LECHE ASADA UNIDAD'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TAJADA DE QUEQUE SABORES', null, 'GRIMANA FOOD', 'PANIFICADOS', 'QUEQUES',
    null, null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    true, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TAJADA DE QUEQUE SABORES'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'EMP MIXTA', null, 'GRIMANA FOOD', 'SNACKS', 'EMPANADAS',
    null, (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'EMP MIXTA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'EMP CARNE', null, 'GRIMANA FOOD', 'SNACKS', 'EMPANADAS',
    null, (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'EMP CARNE'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'EMP POLLO', null, 'GRIMANA FOOD', 'SNACKS', 'EMPANADAS',
    null, (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'EMP POLLO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PP AMERICANA DOBLE QUESO', null, 'GRIMANA FOOD', 'PIZZAS', 'PIZZAS PERSONALES',
    null, null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PP AMERICANA DOBLE QUESO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PRUEBA TRIPLE', null, null, null, null,
    null, null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PRUEBA TRIPLE'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'DELIVERY', null, null, null, null,
    null, null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'servicio', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'DELIVERY'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TORTA 3 LECHES', null, null, 'POSTRES Y PASTELERIA', 'TORTAS',
    'TORTA 3 LECHES', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TORTA 3 LECHES'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TORTA SELVA NEGRA', null, null, 'POSTRES Y PASTELERIA', 'TORTAS',
    'TORTA SELVA NEGRA', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TORTA SELVA NEGRA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TORTA MOKA', null, null, 'POSTRES Y PASTELERIA', 'TORTAS',
    'TORTA MOKA', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TORTA MOKA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TORTA CHOCOLATE', null, null, 'POSTRES Y PASTELERIA', 'TORTAS',
    'TORTA CHOCOLATE', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TORTA CHOCOLATE'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TORTA HELADA', null, null, 'POSTRES Y PASTELERIA', 'TORTAS',
    'TORTA HELADA', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TORTA HELADA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'LECHE ASADA', null, null, 'POSTRES Y PASTELERIA', 'POSTRES AL HORNO',
    'LECHE ASADA', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'LECHE ASADA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'CREMA VOLTEADA', null, null, 'POSTRES Y PASTELERIA', 'POSTRES AL HORNO',
    'CREMA VOLTEADA', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'CREMA VOLTEADA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TARTA DE DURAZNO', null, null, 'POSTRES Y PASTELERIA', 'PAYS Y TARTAS',
    'TARTA DE DURAZNO', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TARTA DE DURAZNO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TARTA DE FRESA', null, null, 'POSTRES Y PASTELERIA', 'PAYS Y TARTAS',
    'TARTA DE FRESA', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TARTA DE FRESA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PAY DE MANZANA', null, null, 'POSTRES Y PASTELERIA', 'PAYS Y TARTAS',
    'PAY DE MANZANA', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PAY DE MANZANA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'EMPANADA MIXTA', null, null, 'SNACKS', 'EMPANADAS',
    'MIXTA', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', false
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'EMPANADA MIXTA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ HIGO', null, null, 'PANIFICADOS', 'QUEQUES ESPECIALES',
    'HIGO BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ HIGO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ CHOCLO', null, null, 'PANIFICADOS', 'QUEQUES ESPECIALES',
    'CHOCLO BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ CHOCLO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ PLATANO', null, null, 'PANIFICADOS', 'QUEQUES ESPECIALES',
    'PLATANO BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ PLATANO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ CHIFFON', null, null, 'PANIFICADOS', 'QUEQUES',
    'CHIFFON ALTO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ CHIFFON'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ BAÑADO EN FOSH', null, null, 'PANIFICADOS', 'QUEQUES',
    'BAÑADO ALTO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ BAÑADO EN FOSH'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ CASTAÑA', null, null, 'PANIFICADOS', 'QUEQUES',
    'CASTAÑA BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ CASTAÑA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ CHOCOLATE BAJO', null, null, 'PANIFICADOS', 'QUEQUES ESPECIALES',
    'CHOCOLATE BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ CHOCOLATE BAJO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ CHOCOLATE ALTO', null, null, 'PANIFICADOS', 'QUEQUES ESPECIALES',
    'CHOCOLATE ALTO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ CHOCOLATE ALTO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ MARMOLEADO BAJO', null, null, 'PANIFICADOS', 'QUEQUES ESPECIALES',
    'MARMOLEADO BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ MARMOLEADO BAJO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ MARMOLEADO ALTO', null, null, 'PANIFICADOS', 'QUEQUES ESPECIALES',
    'MARMOLEADO ALTO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ MARMOLEADO ALTO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ NARANJA BAJO', null, null, 'PANIFICADOS', 'QUEQUES ESPECIALES',
    'NARANJA BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ NARANJA BAJO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ NARANJA ALTO', null, null, 'PANIFICADOS', 'QUEQUES ESPECIALES',
    'NARANJA ALTO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ NARANJA ALTO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ PIÑA ALTO', null, null, 'PANIFICADOS', 'QUEQUES',
    'PIÑA ALTO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ PIÑA ALTO'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ ZANAHORIA', null, null, 'PANIFICADOS', 'QUEQUES',
    'ZANAHORIA BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ ZANAHORIA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'QQ CHOCOCHIP', null, null, 'PANIFICADOS', 'QUEQUES',
    'CHOCOCHIP BAJO NRO 26', (select id from public.proveedores where empresa_id = v_empresa_id and nombre = 'MAZZINI'), 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'QQ CHOCOCHIP'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PP HAWAIANA', null, 'GRIMANA FOOD', 'PIZZAS', 'PIZZAS PERSONALES',
    'HAWAIANA NRO 16', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PP HAWAIANA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PP SALCHICHON', null, 'GRIMANA FOOD', 'PIZZAS', 'PIZZAS PERSONALES',
    'SALCHICHON NRO 16', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PP SALCHICHON'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PP ALEMANA', null, 'GRIMANA FOOD', 'PIZZAS', 'PIZZAS PERSONALES',
    'ALEMANA NRO 16', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PP ALEMANA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PP MIXTA', null, 'GRIMANA FOOD', 'PIZZAS', 'PIZZAS PERSONALES',
    'MIXTA NRO 16', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PP MIXTA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PP JAMON', null, 'GRIMANA FOOD', 'PIZZAS', 'PIZZAS PERSONALES',
    'JAMON NRO 16', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PP JAMON'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PP MIX SALAME', null, 'GRIMANA FOOD', 'PIZZAS', 'PIZZAS PERSONALES',
    'MIX SALAME NRO 16', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PP MIX SALAME'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PP SALAME', null, 'GRIMANA FOOD', 'PIZZAS', 'PIZZAS PERSONALES',
    'SALAME NRO 16', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PP SALAME'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'PP AMERICANA', null, 'GRIMANA FOOD', 'PIZZAS', 'PIZZAS PERSONALES',
    'AMERICANA NRO 16', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'PP AMERICANA'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE PALTA PI', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PI',
    'PALTA', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE PALTA PI'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE PALTA PB', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    'PALTA', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE PALTA PB'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE TROPICAL PI', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PI',
    'TROPICAL', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE TROPICAL PI'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE TROPICAL PB', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    'TROPICAL', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE TROPICAL PB'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE ESPINACA PI', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PI',
    'ESPINACA', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE ESPINACA PI'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE ESPINACA PB', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    'ESPINACA', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE ESPINACA PB'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE HUEVO PI', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PI',
    'HUEVO', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE HUEVO PI'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE HUEVO PB', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    'HUEVO', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE HUEVO PB'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE ACEITUNA PI', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PI',
    'ACEITUNA', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE ACEITUNA PI'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE ACEITUNA PB', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    'ACEITUNA', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE ACEITUNA PB'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE VERDURAS PI', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PI',
    'VERDURAS', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE VERDURAS PI'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE VERDURAS PB', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    'VERDURAS', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE VERDURAS PB'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE LA HUACHANA PI', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PI',
    'LA HUACHANA', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE LA HUACHANA PI'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE LA HUACHANA PB', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    'LA HUACHANA', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE LA HUACHANA PB'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE ROLLS TRADICIONAL PI', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PI',
    'TRADICIONAL', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE ROLLS TRADICIONAL PI'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE ROLLS TRADICIONAL PB', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    'TRADICIONAL', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE ROLLS TRADICIONAL PB'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE TRADICIONAL PI', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PI',
    'TRADICIONAL', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE TRADICIONAL PI'
  );
  insert into public.productos (
    empresa_id, codigo_barra, codigo_proveedor, nombre, descripcion, marca, grupo, familia,
    modelo, proveedor_id, stock_minimo, afectacion_impuesto, tipo_impuesto, cualidad,
    control_inventario, tipo_producto, activo
  )
  select v_empresa_id, null, null, 'TRIPLE TRADICIONAL PB', null, 'TRIPLEMENTE', 'SANDWICHES', 'TRIPLES PB',
    'TRADICIONAL', null, 0, 'Gravado', 'IGV 18%', 'MEDIBLE',
    false, 'bien', true
  where not exists (
    select 1 from public.productos where empresa_id = v_empresa_id and nombre = 'TRIPLE TRADICIONAL PB'
  );

end $$;
