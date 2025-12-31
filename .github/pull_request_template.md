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

## Verification

[Describe how you verified the changes. E.g. "Ran test:signup-critical locally"]
