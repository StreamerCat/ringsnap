# Marketing SEO / AI Discoverability Rollout (Safe + Reversible)

This runbook implements incremental rollout with a kill switch and fast rollback.

## Incremental steps (1-4)

1. **Enable enhanced JSON-LD only**
   - Controlled by `VITE_FEATURE_ENHANCED_MARKETING_SCHEMA`.
   - Default: `true`.

2. **Ship crawler directive updates**
   - Enhanced crawler policy lives in `public/robots.enhanced.txt`.

3. **Ship AI-readable answer content updates**
   - Enhanced content lives in `public/llms.enhanced.txt`.

4. **Monitor + rollback quickly if needed**
   - Run `bash scripts/rollback-marketing-seo.sh`.

## Rollback (single command)

```bash
bash scripts/rollback-marketing-seo.sh
```

Effects:
- Restores baseline `public/robots.txt` and `public/llms.txt`.
- Sets `VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=false` in `.env.production.local`.
- Preserves timestamped backups in `.rollback-backups/`.

## Re-enable enhanced mode

```bash
bash scripts/enable-marketing-seo-enhanced.sh
```
