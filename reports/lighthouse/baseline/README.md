# Baseline Lighthouse run status

Attempted to run Lighthouse locally against:
- http://localhost:4173/
- http://localhost:4173/resources/plumbing-dispatcher-script-template/

Blocked in this environment because fetching the `lighthouse` npm package returns `403 Forbidden`.
Command attempted:

```bash
npx lighthouse http://localhost:4173/ --only-categories=performance,accessibility,best-practices,seo --preset=desktop --output=json --output=html --output-path=reports/lighthouse/baseline/home-desktop --quiet
```
