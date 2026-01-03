# Pull Request

## Description

[Provide a brief description of the changes]

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Critical Path Checklist

**Required for changes to signup, provisioning, or payments:**

- [ ] **No Signup Regressions**: Verified `create-trial` works locally or in staging.
- [ ] **Provisioning Safety**: Verified phone number provisioning logic is idempotent.
- [ ] **Reversible**: Rollback steps are documented if this involves a schema migration.
- [ ] **Test Coverage**: Added/Updated tests in `tests/signup-critical` if logic changed.

## Migration Hygiene Checklist

**Required for changes to `supabase/migrations/`:**

- [ ] **No manual SQL files**: All migrations in `supabase/migrations/` follow naming: `YYYYMMDDHHMMSS_description.sql` (14 digits)
- [ ] **No duplicate timestamps**: No two migrations share the same 14-digit prefix
- [ ] **No COMMENT concatenation**: No `COMMENT ON ... IS 'a' || 'b'` (use single string literal)
- [ ] **No STABLE index predicates**: No `CREATE INDEX ... WHERE expires_at < now()` (use plain index or IMMUTABLE predicate)
- [ ] **No invalid sequence grants**: No `GRANT USAGE ON SEQUENCE table_id_seq` on UUID primary key tables
- [ ] **No parse-time type references**: Migrations referencing rolled-back types (e.g., `signup_channel_type`) must use dynamic SQL to avoid parse errors

_Note: The autofix workflow will attempt to fix common issues automatically on PR. Review and test autofix changes._

## Verification

[Describe how you verified the changes. E.g. "Ran test:signup-critical locally"]
