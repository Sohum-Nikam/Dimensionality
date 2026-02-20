-- Migration: Add constraints to prevent time overlaps in tracking system
-- Created: 2026-02-20
-- Description: Prevents multiple open trackings in same puesto for same window
--              and ensures data integrity for tracking records

-- Step 1: Add unique constraint for open trackings
-- This ensures only one open tracking per (puesto_id, lote, instancia, version)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_tracking 
ON trackings (puesto_id, lote, instancia, version) 
WHERE fecha_final IS NULL;

-- Step 2: Add check constraint to prevent invalid date ranges
ALTER TABLE trackings 
DROP CONSTRAINT IF EXISTS chk_valid_date_range;

ALTER TABLE trackings 
ADD CONSTRAINT chk_valid_date_range 
CHECK (fecha_final IS NULL OR fecha_inicio <= fecha_final);

-- Step 3: Add index for efficient queries on open trackings
CREATE INDEX IF NOT EXISTS idx_trackings_open 
ON trackings (puesto_id, fecha_final) 
WHERE fecha_final IS NULL;

-- Step 4: Add index for chain queries (finding open tracking in other puestos)
CREATE INDEX IF NOT EXISTS idx_trackings_chain 
ON trackings (lote, instancia, version, fecha_final) 
WHERE fecha_final IS NULL;

-- Step 5: Add index for overlap detection queries
CREATE INDEX IF NOT EXISTS idx_trackings_overlap 
ON trackings (puesto_id, fecha_inicio, fecha_final);

-- Step 6: Add column for tracking closure reason (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trackings' 
        AND column_name = 'closure_reason'
    ) THEN
        ALTER TABLE trackings 
        ADD COLUMN closure_reason VARCHAR(100);
    END IF;
END $$;

-- Step 7: Add updated_at timestamp trigger (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trackings' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE trackings 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Step 8: Create function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_trackings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_trackings_updated_at ON trackings;
CREATE TRIGGER trigger_update_trackings_updated_at
    BEFORE UPDATE ON trackings
    FOR EACH ROW
    EXECUTE FUNCTION update_trackings_updated_at();

-- Verification queries (run these to verify migration)
-- SELECT COUNT(*) FROM trackings WHERE fecha_final IS NULL;
-- SELECT puesto_id, COUNT(*) FROM trackings WHERE fecha_final IS NULL GROUP BY puesto_id HAVING COUNT(*) > 1;
