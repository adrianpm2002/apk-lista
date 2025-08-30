-- Agregación de estadísticas diarias para collector
-- Este pseudocódigo SQL muestra la lógica de agregación sin incluir esquemas de tablas

WITH jugadas_collector AS (
  SELECT 
    j.id,
    j.created_at::date as fecha,
    j.numeros,
    j.monto_unitario,
    -- Inferir monto total si no está presente
    COALESCE(j.monto_total, j.monto_unitario * array_length(string_to_array(j.numeros, ','), 1)) as monto_calculado,
    r.numero_ganador,
    l.id as listero_id,
    l.nombre as listero_nombre,
    lot.tipo as loteria_tipo,
    h.nombre as horario_nombre,
    -- Agregar tarifas de números limitados
    array_agg(
      CASE 
        WHEN nl.numero IS NOT NULL 
        THEN nl.tarifa_aplicada 
        ELSE 1.0 
      END
    ) as tarifas_aplicadas,
    array_agg(nl.numero) as numeros_limitados
  FROM jugada j
  JOIN listero l ON j.listero_id = l.id
  JOIN loteria lot ON j.loteria_id = lot.id
  JOIN horario h ON j.horario_id = h.id
  LEFT JOIN resultado r ON j.resultado_id = r.id
  LEFT JOIN numero_limitado nl ON j.id = nl.jugada_id
  WHERE l.collector_id = $1  -- ID del collector
    AND j.created_at >= $2   -- Fecha inicio
    AND j.created_at <= $3   -- Fecha fin
  GROUP BY j.id, j.created_at, j.numeros, j.monto_unitario, j.monto_total, 
           r.numero_ganador, l.id, l.nombre, lot.tipo, h.nombre
),

-- Calcular premios por jugada
jugadas_con_premios AS (
  SELECT 
    *,
    CASE 
      WHEN numero_ganador IS NOT NULL 
      THEN calcular_premio_collector(
        numeros, 
        monto_unitario, 
        loteria_tipo, 
        numero_ganador, 
        tarifas_aplicadas,
        numeros_limitados
      )
      ELSE 0 
    END as premio_calculado
  FROM jugadas_collector
),

-- Agregación diaria
estadisticas_diarias AS (
  SELECT 
    fecha,
    SUM(monto_calculado) as total_recogido,
    SUM(premio_calculado) as total_pagado,
    COUNT(*) as total_jugadas
  FROM jugadas_con_premios
  GROUP BY fecha
),

-- Agregación por listero (para detalles)
estadisticas_por_listero AS (
  SELECT 
    listero_id,
    listero_nombre,
    fecha,
    COUNT(*) as jugadas_listero,
    SUM(monto_calculado) as recogido_listero,
    SUM(premio_calculado) as pagado_listero,
    json_agg(
      json_build_object(
        'id', id,
        'created_at', created_at,
        'numeros', numeros,
        'monto_unitario', monto_unitario,
        'monto_total', monto_calculado,
        'resultado', COALESCE(numero_ganador, 'resultado no disponible'),
        'estado', CASE WHEN premio_calculado > 0 THEN 'bingo' ELSE 'no cogió premio' END,
        'pago_calculado', premio_calculado,
        'loteria_tipo', loteria_tipo,
        'horario', horario_nombre
      )
      ORDER BY created_at DESC
    ) as plays_detalle
  FROM jugadas_con_premios
  GROUP BY listero_id, listero_nombre, fecha
)

-- Query principal para estadísticas diarias
SELECT 
  fecha,
  total_recogido,
  total_pagado,
  (total_recogido - total_pagado) as balance,
  total_jugadas
FROM estadisticas_diarias
ORDER BY fecha DESC;

-- Query para detalles por listero
SELECT 
  listero_id,
  listero_nombre,
  SUM(jugadas_listero) as total_jugadas,
  SUM(recogido_listero) as total_recogido,
  SUM(pagado_listero) as total_pagado,
  (SUM(recogido_listero) - SUM(pagado_listero)) as balance,
  json_agg(plays_detalle) as plays
FROM estadisticas_por_listero
GROUP BY listero_id, listero_nombre
ORDER BY listero_nombre;

-- Función helper para calcular premio con números limitados
CREATE OR REPLACE FUNCTION calcular_premio_collector(
  numeros TEXT,
  monto_unitario DECIMAL,
  loteria_tipo VARCHAR,
  numero_ganador VARCHAR,
  tarifas_aplicadas DECIMAL[],
  numeros_limitados VARCHAR[]
) RETURNS DECIMAL AS $$
DECLARE
  numeros_array TEXT[];
  numero TEXT;
  tarifa DECIMAL;
  premio_base DECIMAL;
  premio_total DECIMAL := 0;
  i INTEGER := 1;
  numero_index INTEGER;
BEGIN
  -- Convertir string de números a array
  numeros_array := string_to_array(numeros, ',');
  
  -- Determinar premio base según tipo de lotería
  premio_base := CASE loteria_tipo
    WHEN 'pick3' THEN 50
    WHEN 'pick4' THEN 500
    ELSE 50  -- Fallback
  END;
  
  -- Iterar sobre cada número jugado
  FOREACH numero IN ARRAY numeros_array LOOP
    -- Si el número coincide con el ganador
    IF trim(numero) = trim(numero_ganador) THEN
      -- Buscar si el número tiene tarifa limitada
      tarifa := 1.0;  -- Tarifa regular por defecto
      
      FOR numero_index IN 1..array_length(numeros_limitados, 1) LOOP
        IF numeros_limitados[numero_index] = trim(numero) THEN
          tarifa := tarifas_aplicadas[numero_index];
          EXIT;
        END IF;
      END LOOP;
      
      -- Calcular premio para este número
      premio_total := premio_total + (monto_unitario * premio_base * tarifa);
    END IF;
    
    i := i + 1;
  END LOOP;
  
  RETURN premio_total;
END;
$$ LANGUAGE plpgsql;

-- Query para totales históricos del collector
WITH totales_historicos AS (
  SELECT 
    SUM(
      COALESCE(j.monto_total, j.monto_unitario * array_length(string_to_array(j.numeros, ','), 1))
    ) as total_recogido_historico,
    
    SUM(
      CASE 
        WHEN r.numero_ganador IS NOT NULL 
        THEN calcular_premio_collector(
          j.numeros, 
          j.monto_unitario, 
          lot.tipo, 
          r.numero_ganador,
          COALESCE(array_agg(nl.tarifa_aplicada), ARRAY[1.0]),
          COALESCE(array_agg(nl.numero), ARRAY[]::VARCHAR[])
        )
        ELSE 0 
      END
    ) as total_pagado_historico
    
  FROM jugada j
  JOIN listero l ON j.listero_id = l.id
  JOIN loteria lot ON j.loteria_id = lot.id
  LEFT JOIN resultado r ON j.resultado_id = r.id
  LEFT JOIN numero_limitado nl ON j.id = nl.jugada_id
  WHERE l.collector_id = $1
  GROUP BY j.id, j.numeros, j.monto_unitario, j.monto_total, 
           r.numero_ganador, lot.tipo
)

SELECT 
  total_recogido_historico,
  total_pagado_historico,
  (total_recogido_historico - total_pagado_historico) as balance_historico
FROM totales_historicos;

-- CTE para filtros avanzados (cuando se aplican filtros)
WITH jugadas_filtradas AS (
  SELECT j.*
  FROM jugada j
  JOIN listero l ON j.listero_id = l.id
  JOIN loteria lot ON j.loteria_id = lot.id
  JOIN horario h ON j.horario_id = h.id
  WHERE l.collector_id = $1
    AND j.created_at >= $2
    AND j.created_at <= $3
    AND ($4 IS NULL OR lot.nombre = $4)     -- Filtro lotería
    AND ($5 IS NULL OR h.nombre = $5)       -- Filtro horario
    AND ($6 IS NULL OR l.id = $6)           -- Filtro listero específico
)

-- El resto de la query usa jugadas_filtradas en lugar de jugada
SELECT * FROM jugadas_filtradas;

-- Índices recomendados para optimización:
-- CREATE INDEX idx_jugada_collector_date ON jugada(listero_id, created_at);
-- CREATE INDEX idx_listero_collector ON listero(collector_id);
-- CREATE INDEX idx_numero_limitado_jugada ON numero_limitado(jugada_id);
-- CREATE INDEX idx_resultado_jugada ON resultado(jugada_id);

-- Vista materializada para estadísticas históricas (opcional para mejor performance)
-- CREATE MATERIALIZED VIEW collector_stats_summary AS
-- SELECT 
--   l.collector_id,
--   COUNT(*) as total_jugadas,
--   SUM(j.monto_total) as total_recogido,
--   SUM(premios.total) as total_pagado
-- FROM jugada j
-- JOIN listero l ON j.listero_id = l.id
-- LEFT JOIN (calculación de premios) premios ON j.id = premios.jugada_id
-- GROUP BY l.collector_id;

-- REFRESH MATERIALIZED VIEW collector_stats_summary;  -- Ejecutar periódicamente
