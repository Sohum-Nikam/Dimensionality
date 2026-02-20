# Fix Time Overlap Issues - Production-Grade Task List

## Problem Statement
Multiple tracking records are being created simultaneously in the same workstation (puesto) for different windows (lotes), causing time overlaps. Workstations operate in a chain: when workstation 1 finishes with a window, workstation 2 continues with that same window. **At the same time, the same workstation cannot have multiple trackings for the same window.**

---

## Critical Issues Identified

1. **Multiple open trackings simultaneously** in the same puesto
2. **Time overlaps** in the same puesto with different lotes but same instancia/versión
3. **Orphaned trackings** (open >24h without activity)
4. **Missing lote filter** in tracking queries (already partially fixed)
5. **No validation** before creating new trackings

---

## Task List (Priority Order)

### 🔴 CRITICAL - Data Integrity & Structural Fixes

#### Task 1: Verify lote Filter in All Tracking Queries
**Priority:** CRITICAL  
**Status:** PENDING  
**Files to Check:**
- All database queries that find/retrieve tracking records
- API endpoints that search for trackings
- Service layer methods that query trackings

**Acceptance Criteria:**
- [ ] All queries include `WHERE lote = ?` filter
- [ ] No queries search by instancia/versión/puesto_id without lote
- [ ] Code review confirms lote is mandatory parameter
- [ ] Unit tests verify lote filter is applied

**Implementation Notes:**
- Search codebase for: `SELECT * FROM trackings`, `findTracking`, `getTracking`
- Ensure all methods require `lote` parameter
- Add TypeScript/type checks to enforce lote requirement

---

#### Task 2: Add Database Constraint - Single Open Tracking per (puesto_id, lote, instancia, versión)
**Priority:** CRITICAL  
**Status:** PENDING  
**Type:** Database Migration

**SQL Migration:**
```sql
-- Add unique constraint for open trackings
CREATE UNIQUE INDEX idx_unique_open_tracking 
ON trackings (puesto_id, lote, instancia, version) 
WHERE fecha_final IS NULL;

-- Add check constraint to prevent fecha_inicio > fecha_final
ALTER TABLE trackings 
ADD CONSTRAINT chk_valid_date_range 
CHECK (fecha_final IS NULL OR fecha_inicio <= fecha_final);
```

**Acceptance Criteria:**
- [ ] Migration script created and tested
- [ ] Constraint prevents duplicate open trackings
- [ ] Existing violations identified and resolved before migration
- [ ] Rollback script prepared
- [ ] Migration tested in staging environment

**Implementation Notes:**
- First, identify all existing violations using Task 8 query
- Close or fix orphaned trackings before applying constraint
- Test constraint with concurrent insert attempts

---

#### Task 3: Implement Pre-Creation Validation - Check for Open Trackings
**Priority:** CRITICAL  
**Status:** PENDING  
**Location:** Service layer / API handler

**Logic:**
```typescript
async function createTracking(data: {
  puesto_id: number;
  lote: string;
  instancia: number;
  version: number;
  fecha_inicio: Date;
}) {
  // CRITICAL: Check for ANY open tracking in same puesto
  const openTrackings = await db.query(`
    SELECT id, lote, instancia, version, fecha_inicio
    FROM trackings
    WHERE puesto_id = $1
      AND fecha_final IS NULL
    ORDER BY fecha_inicio DESC
    LIMIT 1
  `, [data.puesto_id]);

  if (openTrackings.length > 0) {
    const openTracking = openTrackings[0];
    
    // If same window (lote/instancia/versión), close existing and create new
    if (openTracking.lote === data.lote && 
        openTracking.instancia === data.instancia && 
        openTracking.version === data.version) {
      await closeTracking(openTracking.id, data.fecha_inicio);
    } else {
      // Different window - this is an error (workstation can't work on two windows simultaneously)
      throw new Error(
        `Cannot create tracking: Workstation ${data.puesto_id} already has open tracking ` +
        `for window (lote: ${openTracking.lote}, instancia: ${openTracking.instancia}, ` +
        `version: ${openTracking.version}) started at ${openTracking.fecha_inicio}`
      );
    }
  }

  // Now create new tracking
  return await db.insert('trackings', data);
}
```

**Acceptance Criteria:**
- [ ] Validation runs before every tracking creation
- [ ] Error thrown if different window is open
- [ ] Existing tracking closed if same window
- [ ] Logging added for all validation checks
- [ ] Unit tests cover all scenarios

---

#### Task 4: Implement Chain Logic - Auto-Close Tracking When Window Moves to Next Workstation
**Priority:** HIGH  
**Status:** PENDING  
**Location:** Service layer

**Logic:**
```typescript
async function createTracking(data: {
  puesto_id: number;
  lote: string;
  instancia: number;
  version: number;
  fecha_inicio: Date;
}) {
  // Check if this window is open in ANY other workstation
  const openInOtherWorkstation = await db.query(`
    SELECT id, puesto_id, fecha_inicio
    FROM trackings
    WHERE lote = $1
      AND instancia = $2
      AND version = $3
      AND puesto_id != $4
      AND fecha_final IS NULL
    ORDER BY fecha_inicio DESC
    LIMIT 1
  `, [data.lote, data.instancia, data.version, data.puesto_id]);

  if (openInOtherWorkstation.length > 0) {
    const previousTracking = openInOtherWorkstation[0];
    // Close tracking in previous workstation (chain logic)
    await closeTracking(previousTracking.id, data.fecha_inicio);
    logger.info({
      event: 'tracking_chain_close',
      previous_puesto: previousTracking.puesto_id,
      new_puesto: data.puesto_id,
      lote: data.lote,
      instancia: data.instancia,
      version: data.version
    });
  }

  // Continue with Task 3 validation and creation
  // ...
}
```

**Acceptance Criteria:**
- [ ] Automatically closes tracking in previous workstation
- [ ] Logs chain transitions for audit trail
- [ ] Handles edge cases (multiple open trackings, race conditions)
- [ ] Integration tests verify chain behavior
- [ ] Performance tested (query optimization)

---

### 🟡 HIGH PRIORITY - Data Cleanup & Monitoring

#### Task 5: Create SQL Query to Detect All Time Overlaps
**Priority:** HIGH  
**Status:** PENDING  
**Type:** Diagnostic Query

**SQL Query:**
```sql
-- Find all time overlaps in the same puesto
WITH tracking_periods AS (
  SELECT 
    id,
    puesto_id,
    lote,
    instancia,
    version,
    fecha_inicio,
    COALESCE(fecha_final, CURRENT_TIMESTAMP) AS fecha_final,
    CASE WHEN fecha_final IS NULL THEN true ELSE false END AS is_open
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
  t2.id AS tracking2_id,
  t2.lote AS lote2,
  t2.instancia AS instancia2,
  t2.version AS version2,
  t2.fecha_inicio AS inicio2,
  t2.fecha_final AS final2,
  t2.is_open AS open2,
  -- Calculate overlap duration
  GREATEST(
    0,
    EXTRACT(EPOCH FROM (LEAST(t1.fecha_final, t2.fecha_final) - GREATEST(t1.fecha_inicio, t2.fecha_inicio)))
  ) AS overlap_seconds
FROM tracking_periods t1
INNER JOIN tracking_periods t2
  ON t1.puesto_id = t2.puesto_id
  AND t1.id < t2.id  -- Avoid duplicate pairs
WHERE 
  -- Check for time overlap
  t1.fecha_inicio < t2.fecha_final
  AND t1.fecha_final > t2.fecha_inicio
ORDER BY t1.puesto_id, t1.fecha_inicio;
```

**Acceptance Criteria:**
- [ ] Query returns all overlaps
- [ ] Results include overlap duration
- [ ] Query performance acceptable (<5s for 100k records)
- [ ] Results exported for analysis
- [ ] Query saved as stored procedure/view

---

#### Task 6: Create Migration Script to Close Orphaned Trackings
**Priority:** HIGH  
**Status:** PENDING  
**Type:** Data Migration Script

**SQL Script:**
```sql
-- Close trackings open for more than 24 hours without activity
UPDATE trackings
SET 
  fecha_final = fecha_inicio + INTERVAL '24 hours',
  updated_at = CURRENT_TIMESTAMP,
  closure_reason = 'AUTO_CLOSED_ORPHANED'
WHERE 
  fecha_final IS NULL
  AND fecha_inicio < CURRENT_TIMESTAMP - INTERVAL '24 hours'
  AND NOT EXISTS (
    -- Check if there's a newer tracking for same window in any workstation
    SELECT 1 
    FROM trackings t2
    WHERE t2.lote = trackings.lote
      AND t2.instancia = trackings.instancia
      AND t2.version = trackings.version
      AND t2.fecha_inicio > trackings.fecha_inicio
  );

-- Log affected records
SELECT 
  id,
  puesto_id,
  lote,
  instancia,
  version,
  fecha_inicio,
  fecha_final,
  closure_reason
FROM trackings
WHERE closure_reason = 'AUTO_CLOSED_ORPHANED';
```

**Acceptance Criteria:**
- [ ] Script identifies all orphaned trackings
- [ ] Closes trackings >24h old
- [ ] Preserves trackings that are part of active chain
- [ ] Adds closure_reason for audit
- [ ] Dry-run mode available
- [ ] Rollback procedure documented

---

#### Task 7: Add Comprehensive Logging for Tracking Operations
**Priority:** HIGH  
**Status:** PENDING  
**Location:** Service layer

**Logging Points:**
```typescript
// Log all tracking creation attempts
logger.info({
  event: 'tracking_create_attempt',
  puesto_id,
  lote,
  instancia,
  version,
  fecha_inicio,
  existing_open_trackings: openTrackings.length
});

// Log validation failures
logger.warn({
  event: 'tracking_validation_failed',
  puesto_id,
  lote,
  instancia,
  version,
  reason: 'open_tracking_exists',
  conflicting_tracking_id: openTracking.id
});

// Log chain transitions
logger.info({
  event: 'tracking_chain_transition',
  from_puesto: previousTracking.puesto_id,
  to_puesto: puesto_id,
  lote,
  instancia,
  version,
  transition_time: fecha_inicio
});

// Log constraint violations (if caught)
logger.error({
  event: 'tracking_constraint_violation',
  puesto_id,
  lote,
  instancia,
  version,
  error: error.message,
  stack: error.stack
});
```

**Acceptance Criteria:**
- [ ] All tracking operations logged
- [ ] Logs include context (puesto, lote, instancia, versión)
- [ ] Logs structured (JSON format)
- [ ] Logs searchable by puesto_id, lote, date range
- [ ] Alerting configured for error logs
- [ ] Log retention policy defined

---

### 🟢 MEDIUM PRIORITY - Testing & Validation

#### Task 8: Create Unit Tests for Tracking Validation Logic
**Priority:** MEDIUM  
**Status:** PENDING  
**Type:** Unit Tests

**Test Cases:**
```typescript
describe('Tracking Validation', () => {
  it('should prevent creating tracking when different window is open', async () => {
    // Setup: Create open tracking for lote A
    await createTracking({ puesto_id: 1, lote: 'A', instancia: 1, version: 1 });
    
    // Attempt: Create tracking for lote B in same puesto
    await expect(
      createTracking({ puesto_id: 1, lote: 'B', instancia: 1, version: 1 })
    ).rejects.toThrow('Cannot create tracking: Workstation already has open tracking');
  });

  it('should close existing tracking when same window is scanned again', async () => {
    // Setup: Create open tracking
    const tracking1 = await createTracking({ puesto_id: 1, lote: 'A', instancia: 1, version: 1 });
    
    // Action: Create tracking for same window
    const tracking2 = await createTracking({ puesto_id: 1, lote: 'A', instancia: 1, version: 1 });
    
    // Verify: First tracking is closed
    const closed = await getTracking(tracking1.id);
    expect(closed.fecha_final).not.toBeNull();
    expect(closed.fecha_final).toEqual(tracking2.fecha_inicio);
  });

  it('should allow chain transition (puesto 1 → puesto 2)', async () => {
    // Setup: Create tracking in puesto 1
    const tracking1 = await createTracking({ puesto_id: 1, lote: 'A', instancia: 1, version: 1 });
    
    // Action: Create tracking in puesto 2 for same window
    const tracking2 = await createTracking({ puesto_id: 2, lote: 'A', instancia: 1, version: 1 });
    
    // Verify: Tracking in puesto 1 is closed
    const closed = await getTracking(tracking1.id);
    expect(closed.fecha_final).not.toBeNull();
    expect(closed.fecha_final).toEqual(tracking2.fecha_inicio);
  });

  it('should enforce unique constraint for open trackings', async () => {
    // Setup: Create open tracking
    await createTracking({ puesto_id: 1, lote: 'A', instancia: 1, version: 1 });
    
    // Attempt: Create duplicate open tracking (should fail at DB level)
    await expect(
      db.insert('trackings', { puesto_id: 1, lote: 'A', instancia: 1, version: 1, fecha_final: null })
    ).rejects.toThrow('duplicate key value violates unique constraint');
  });
});
```

**Acceptance Criteria:**
- [ ] All validation scenarios tested
- [ ] Edge cases covered (race conditions, concurrent inserts)
- [ ] Tests run in CI/CD pipeline
- [ ] Code coverage >90% for tracking logic
- [ ] Tests use test database (not production)

---

#### Task 9: Create Integration Test for Chain Workflow
**Priority:** MEDIUM  
**Status:** PENDING  
**Type:** Integration Test

**Test Scenario:**
```typescript
describe('Chain Workflow Integration', () => {
  it('should handle complete chain: puesto 1 → puesto 2 → puesto 3', async () => {
    const window = { lote: 'TEST001', instancia: 1, version: 1 };
    
    // Step 1: Start in puesto 1
    const t1 = await createTracking({ puesto_id: 1, ...window, fecha_inicio: '2026-02-20 10:00:00' });
    expect(t1.fecha_final).toBeNull();
    
    // Step 2: Move to puesto 2
    const t2 = await createTracking({ puesto_id: 2, ...window, fecha_inicio: '2026-02-20 10:30:00' });
    const closed_t1 = await getTracking(t1.id);
    expect(closed_t1.fecha_final).toEqual('2026-02-20 10:30:00');
    expect(t2.fecha_final).toBeNull();
    
    // Step 3: Move to puesto 3
    const t3 = await createTracking({ puesto_id: 3, ...window, fecha_inicio: '2026-02-20 11:00:00' });
    const closed_t2 = await getTracking(t2.id);
    expect(closed_t2.fecha_final).toEqual('2026-02-20 11:00:00');
    expect(t3.fecha_final).toBeNull();
    
    // Verify: No overlaps exist
    const overlaps = await findOverlaps();
    expect(overlaps.filter(o => 
      o.lote === window.lote && 
      o.instancia === window.instancia && 
      o.version === window.version
    )).toHaveLength(0);
  });
});
```

**Acceptance Criteria:**
- [ ] Complete chain workflow tested
- [ ] Multiple windows in parallel tested
- [ ] Concurrent access scenarios tested
- [ ] Performance benchmarks established
- [ ] Test data cleanup automated

---

#### Task 10: Create Monitoring Dashboard Query
**Priority:** MEDIUM  
**Status:** PENDING  
**Type:** Monitoring Query

**Metrics to Track:**
```sql
-- Current open trackings per puesto
SELECT 
  puesto_id,
  COUNT(*) AS open_trackings_count,
  ARRAY_AGG(DISTINCT lote) AS active_lotes
FROM trackings
WHERE fecha_final IS NULL
GROUP BY puesto_id
ORDER BY open_trackings_count DESC;

-- Average tracking duration by puesto
SELECT 
  puesto_id,
  AVG(EXTRACT(EPOCH FROM (fecha_final - fecha_inicio))) AS avg_duration_seconds,
  COUNT(*) AS completed_trackings
FROM trackings
WHERE fecha_final IS NOT NULL
  AND fecha_inicio >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY puesto_id;

-- Orphaned trackings alert
SELECT 
  puesto_id,
  lote,
  instancia,
  version,
  fecha_inicio,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fecha_inicio)) / 3600 AS hours_open
FROM trackings
WHERE fecha_final IS NULL
  AND fecha_inicio < CURRENT_TIMESTAMP - INTERVAL '12 hours'
ORDER BY hours_open DESC;
```

**Acceptance Criteria:**
- [ ] Dashboard shows real-time metrics
- [ ] Alerts configured for anomalies
- [ ] Historical trends tracked
- [ ] Export functionality available
- [ ] Access controls implemented

---

## Implementation Order

1. **Week 1: Critical Fixes**
   - Task 1: Verify lote filter
   - Task 2: Add database constraint
   - Task 5: Create overlap detection query

2. **Week 2: Validation & Chain Logic**
   - Task 3: Pre-creation validation
   - Task 4: Chain auto-close logic
   - Task 7: Comprehensive logging

3. **Week 3: Data Cleanup**
   - Task 6: Close orphaned trackings
   - Run Task 5 query to verify fixes

4. **Week 4: Testing & Monitoring**
   - Task 8: Unit tests
   - Task 9: Integration tests
   - Task 10: Monitoring dashboard

---

## Success Criteria

✅ **Zero time overlaps** in same puesto  
✅ **Zero orphaned trackings** (>24h open)  
✅ **100% chain transitions** logged and verified  
✅ **Database constraints** prevent violations  
✅ **All tests passing** in CI/CD  
✅ **Monitoring alerts** configured  

---

## Risk Mitigation

- **Data Loss Risk:** All migrations include rollback scripts
- **Performance Risk:** Indexes added for query optimization
- **Concurrency Risk:** Database-level constraints prevent race conditions
- **Deployment Risk:** Staged rollout (staging → production)

---

## Notes

- All code changes must maintain backward compatibility
- Database migrations must be reversible
- Logging must not impact performance (<10ms overhead)
- Tests must run in <5 minutes for CI/CD
