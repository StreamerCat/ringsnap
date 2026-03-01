# After Lighthouse run status

After implementing SEO/performance fixes, Lighthouse re-run remains blocked in this environment due to npm registry access returning `403 Forbidden` for the `lighthouse` package.

Use the same command locally where Lighthouse is available:

```bash
npx lighthouse http://localhost:4173/ --only-categories=performance,accessibility,best-practices,seo --preset=desktop --output=json --output=html --output-path=reports/lighthouse/after/home-desktop --quiet
```
