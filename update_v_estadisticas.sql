CREATE OR REPLACE VIEW v_estadisticas AS
SELECT
  t.*,

  -- ganancias
  (COALESCE(t.monto_total,0) * COALESCE(t.pct_listero,0) / 100)::numeric(12,2) AS ganancia_listero,
  (COALESCE(t.monto_total,0) * COALESCE(t.pct_colector,0) / 100)::numeric(12,2) AS ganancia_colector,

  -- balances
  ( COALESCE(t.monto_total,0)
    - COALESCE(t.monto_a_pagar,0)
    - (COALESCE(t.monto_total,0) * COALESCE(t.pct_listero,0) / 100)
  )::numeric(12,2) AS balance_listero,

  ( COALESCE(t.monto_total,0)
    - COALESCE(t.monto_a_pagar,0)
    - (COALESCE(t.monto_total,0) * COALESCE(t.pct_colector,0) / 100)
    - (COALESCE(t.monto_total,0) * COALESCE(t.pct_listero,0) / 100)  -- resta también ganancia del listero
  )::numeric(12,2) AS balance_colector,

  -- estado del horario: 'abierta' o 'cerrada'
  CASE
    WHEN t.fecha_jugada::date < tz.cur_date THEN 'cerrada'
    WHEN t.fecha_jugada::date = tz.cur_date
      AND (
        t.resultado IS NULL
        OR (
          t.hora_inicio IS NOT NULL AND t.hora_fin IS NOT NULL
          AND (
            (t.hora_inicio <= t.hora_fin AND tz.cur_time >= t.hora_inicio AND tz.cur_time <= t.hora_fin)
            OR
            (t.hora_inicio > t.hora_fin AND (tz.cur_time >= t.hora_inicio OR tz.cur_time <= t.hora_fin))
          )
        )
      ) THEN 'abierta'
    ELSE 'cerrada'
  END AS estado_horario,

  -- Agregar id_colector e id_banco desde profiles
  p.id_collector AS id_colector,
  p.id_banco

FROM (
  SELECT
    vr.*,
    COALESCE((vr.configuracion_precio -> vr.tipo_jugada ->> 'listeroPct')::numeric, 0) AS pct_listero,
    COALESCE((vr.configuracion_precio -> vr.tipo_jugada ->> 'collectorPct')::numeric, 0) AS pct_colector
  FROM v_registro_diario vr
) t
LEFT JOIN profiles p ON t.id_listero = p.id
CROSS JOIN (
  SELECT
    (now() AT TIME ZONE 'America/Havana')::date AS cur_date,
    (now() AT TIME ZONE 'America/Havana')::time AS cur_time
) tz;
