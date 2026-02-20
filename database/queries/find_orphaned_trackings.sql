-- Query: Find orphaned trackings (open for more than specified hours)
-- Purpose: Identify trackings that should be closed but remain open
-- Usage: Run this before migration to close orphaned trackings

-- Find trackings open for more than 24 hours
SELECT 
  id,
  puesto_id,
  lote,
  instancia,
  version,
  fecha_inicio,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fecha_inicio)) / 3600 AS hours_open,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fecha_inicio)) / 86400 AS days_open,
  user_id,
  created_at,
  updated_at,
  -- Check if there's a newer tracking for same window in any puesto (chain continuation)
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM trackings t2
      WHERE t2.lote = trackings.lote
        AND t2.instancia = trackings.instancia
        AND t2.version = trackings.version
        AND t2.fecha_inicio > trackings.fecha_inicio
    ) THEN true
    ELSE false
  END AS has_continuation,
  -- Check if there's an open tracking for same window in different puesto
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM trackings t2
      WHERE t2.lote = trackings.lote
        AND t2.instancia = trackings.instancia
        AND t2.version = trackings.version
        AND t2.puesto_id != trackings.puesto_id
        AND t2.fecha_final IS NULL
    ) THEN true
    ELSE false
  END AS open_in_other_puesto
FROM trackings
WHERE 
  fecha_final IS NULL
  AND fecha_inicio < CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY 
  hours_open DESC,
  puesto_id;

-- Summary: Count orphaned trackings by puesto
-- SELECT 
--   puesto_id,
--   COUNT(*) AS orphaned_count,
--   AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fecha_inicio)) / 3600) AS avg_hours_open,
--   MAX(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fecha_inicio)) / 3600) AS max_hours_open
-- FROM trackings
-- WHERE 
--   fecha_final IS NULL
--   AND fecha_inicio < CURRENT_TIMESTAMP - INTERVAL '24 hours'
-- GROUP BY puesto_id
-- ORDER BY orphaned_count DESC;
