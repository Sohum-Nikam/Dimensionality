# Tracking System Time Overlap Fix - Implementation Guide

## Overview

This directory contains the complete implementation to fix time overlap issues in the tracking system. The solution ensures that:
- No two trackings can overlap in the same puesto (workstation)
- Chain logic automatically closes trackings when windows move between puestos
- Database constraints prevent violations at the data layer
- Comprehensive monitoring and alerting

## Directory Structure

```
.
├── database/
│   ├── migrations/
│   │   ├── 001_add_tracking_constraints.sql    # Database constraints
│   │   └── 002_close_orphaned_trackings.sql    # Data cleanup
│   └── queries/
│       ├── detect_overlaps.sql                 # Overlap detection
│       ├── find_orphaned_trackings.sql          # Orphan detection
│       └── monitoring_dashboard.sql             # Monitoring queries
├── src/
│   ├── services/
│   │   └── trackingService.ts                  # Core service logic
│   └── tests/
│       ├── trackingService.test.ts              # Unit tests
│       └── trackingService.integration.test.ts  # Integration tests
└── README_TRACKING_FIX.md                       # This file
```

## Implementation Steps

### Step 1: Review Existing Data

Before applying migrations, review existing data:

```bash
# Run overlap detection query
psql -d your_database -f database/queries/detect_overlaps.sql > overlaps_report.txt

# Run orphaned tracking detection
psql -d your_database -f database/queries/find_orphaned_trackings.sql > orphaned_report.txt
```

### Step 2: Apply Database Migrations

**IMPORTANT:** Run migrations in order and review results:

```bash
# 1. Add constraints (will fail if violations exist)
psql -d your_database -f database/migrations/001_add_tracking_constraints.sql

# 2. Close orphaned trackings (review preview first!)
psql -d your_database -f database/migrations/002_close_orphaned_trackings.sql
```

### Step 3: Deploy Service Code

1. Copy `src/services/trackingService.ts` to your backend service directory
2. Update imports to match your project structure
3. Ensure database connection is configured
4. Ensure logger is configured

### Step 4: Update API Endpoints

Replace existing tracking creation endpoints with calls to `createTracking()`:

```typescript
import { createTracking } from './services/trackingService';

// In your API handler
app.post('/api/trackings', async (req, res) => {
  try {
    const tracking = await createTracking(req.body);
    res.json(tracking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Step 5: Run Tests

```bash
# Unit tests
npm test -- trackingService.test.ts

# Integration tests (requires test database)
npm test -- trackingService.integration.test.ts
```

### Step 6: Set Up Monitoring

1. Schedule overlap detection query (daily)
2. Set up alerts for orphaned trackings (>12 hours)
3. Create dashboard using monitoring queries
4. Configure error alerting for validation failures

## Configuration

### Environment Variables

```bash
# Database connection
DATABASE_URL=postgresql://user:password@host:port/database

# Test database (for integration tests)
TEST_DATABASE_URL=postgresql://user:password@host:port/test_database

# Logging
LOG_LEVEL=info
```

### Database Requirements

- PostgreSQL 12+ (for partial indexes with WHERE clauses)
- Existing `trackings` table with columns:
  - `id` (primary key)
  - `puesto_id` (integer)
  - `lote` (string)
  - `instancia` (integer)
  - `version` (integer)
  - `fecha_inicio` (timestamp)
  - `fecha_final` (timestamp, nullable)
  - `user_id` (integer, nullable)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

## Monitoring

### Key Metrics to Track

1. **Open Trackings per Puesto** - Should be ≤ 1
2. **Orphaned Trackings** - Should be 0
3. **Overlap Count** - Should be 0
4. **Validation Failures** - Monitor for spikes
5. **Chain Transitions** - Track workflow health

### Alert Thresholds

- **Critical:** Orphaned tracking >24 hours
- **Warning:** Orphaned tracking >12 hours
- **Critical:** Overlap detected
- **Warning:** Validation failure rate >5%

## Rollback Plan

If issues occur:

1. **Rollback Migration 001:**
```sql
DROP INDEX IF EXISTS idx_unique_open_tracking;
DROP INDEX IF EXISTS idx_trackings_open;
DROP INDEX IF EXISTS idx_trackings_chain;
DROP INDEX IF EXISTS idx_trackings_overlap;
ALTER TABLE trackings DROP CONSTRAINT IF EXISTS chk_valid_date_range;
```

2. **Rollback Migration 002:**
```sql
UPDATE trackings 
SET fecha_final = NULL, closure_reason = NULL 
WHERE closure_reason = 'AUTO_CLOSED_ORPHANED';
```

3. **Revert Service Code:** Deploy previous version

## Troubleshooting

### Constraint Violation on Migration

If migration 001 fails due to existing violations:

1. Run overlap detection query to identify violations
2. Manually fix violations (close duplicate open trackings)
3. Re-run migration

### Service Validation Errors

If validation errors occur:

1. Check logs for specific error details
2. Verify database connection
3. Check that lote filter is applied in all queries
4. Review concurrent operation handling

### Performance Issues

If queries are slow:

1. Verify indexes are created (check with `\d trackings` in psql)
2. Analyze query plans: `EXPLAIN ANALYZE <query>`
3. Consider adding additional indexes based on query patterns

## Success Criteria

✅ Zero time overlaps in same puesto  
✅ Zero orphaned trackings (>24h open)  
✅ Database constraints prevent violations  
✅ All tests passing  
✅ Monitoring alerts configured  
✅ Chain transitions working correctly  

## Support

For issues or questions:
1. Check logs: `src/utils/logger.ts`
2. Review test cases for expected behavior
3. Run diagnostic queries in `database/queries/`
4. Check database constraints: `\d trackings` in psql

## Version History

- **v1.0.0** (2026-02-20): Initial implementation
  - Database constraints
  - Service validation logic
  - Chain transition support
  - Comprehensive testing
  - Monitoring queries
