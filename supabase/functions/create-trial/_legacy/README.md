# Legacy Create-Trial Implementations

This directory contains archived, unused versions of the create-trial function.

## index-v2.ts

**Status**: ARCHIVED (Never deployed or integrated)

**Why archived**:
- Uses incompatible field names (`signup_channel` instead of `source`)
- Frontend codebase uses `source: "website"` and `source: "sales"` throughout
- Never integrated with the production frontend
- Created as a proposed refactor but never fully implemented

**Current canonical version**: `supabase/functions/create-trial/index.ts`

The canonical `index.ts` version:
- Uses `source` enum with values `["website", "sales"]`
- Fully integrated with all frontend signup flows
- Deployed to production (no config.toml override)
- Implements idempotent account creation with Stripe integration

**Note**: If you need features from index-v2.ts, port them to index.ts while maintaining the existing field names and API compatibility.
