-- Query: Detect all time overlaps in tracking system
-- Purpose: Identify overlapping tracking records in the same puesto
-- Usage: Run this query periodically to monitor for overlaps

WITH tracking_periods AS (
  SELECT 
    id,
    puesto_id,
    lote,
    instancia,
    version,
    fecha_inicio,
    COALESCE(fecha_final, CURRENT_TIMESTAMP) AS fecha_final,
    CASE WHEN fecha_final IS NULL THEN true ELSE false END AS is_open,
    user_id,
    created_at,
    updated_at
  FROM trackings
)
SELECT 
  t1.id AS tracking1_id,
  t1.puesto_id,
  t1.lote AS lote1,
  t1.instancia AS instancia1,
  t1.version AS version1,
  t1.fecha_inicio AS inicio1,
  t1.fecha_final AS final1,
  t1.is_open AS open1,
  t1.user_id AS user1_id,
  t2.id AS tracking2_id,
  t2.lote AS lote2,
  t2.instancia AS instancia2,
  t2.version AS version2,
  t2.fecha_inicio AS inicio2,
  t2.fecha_final AS final2,
  t2.is_open AS open2,
  t2.user_id AS user2_id,
  -- Calculate overlap duration in seconds
  GREATEST(
    0,
    EXTRACT(EPOCH FROM (LEAST(t1.fecha_final, t2.fecha_final) - GREATEST(t1.fecha_inicio, t2.fecha_inicio)))
  ) AS overlap_seconds,
  -- Calculate overlap duration in hours (for readability)
  ROUND(
    GREATEST(
      0,
      EXTRACT(EPOCH FROM (LEAST(t1.fecha_final, t2.fecha_final) - GREATEST(t1.fecha_inicio, t2.fecha_inicio)))
    ) / 3600.0,
    2
  ) AS overlap_hours,
  -- Flag if same window (should never overlap)
  CASE 
    WHEN t1.lote = t2.lote AND t1.instancia = t2.instancia AND t1.version = t2.version 
    THEN true 
    ELSE false 
  END AS same_window
FROM tracking_periods t1
INNER JOIN tracking_periods t2
  ON t1.puesto_id = t2.puesto_id
  AND t1.id < t2.id  -- Avoid duplicate pairs
WHERE 
  -- Check for time overlap
  t1.fecha_inicio < t2.fecha_final
  AND t1.fecha_final > t2.fecha_inicio
ORDER BY 
  t1.puesto_id, 
  t1.fecha_inicio,
  overlap_seconds DESC;

-- Summary query: Count overlaps by puesto
-- SELECT 
--   puesto_id,
--   COUNT(*) AS overlap_count,
--   SUM(overlap_seconds) AS total_overlap_seconds,
--   AVG(overlap_seconds) AS avg_overlap_seconds
-- FROM (
--   -- Use the query above as subquery
-- ) overlaps
-- GROUP BY puesto_id
-- ORDER BY overlap_count DESC;
