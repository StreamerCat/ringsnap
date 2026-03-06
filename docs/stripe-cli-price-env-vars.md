# Stripe CLI: Generate env vars for new pricing price IDs

This project now includes a helper script that uses the Stripe CLI to print the 8 env vars needed for the new pricing model:

- `STRIPE_PRICE_ID_NIGHT_WEEKEND`
- `STRIPE_PRICE_ID_LITE`
- `STRIPE_PRICE_ID_CORE`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_OVERAGE_PRICE_ID_NIGHT_WEEKEND`
- `STRIPE_OVERAGE_PRICE_ID_LITE`
- `STRIPE_OVERAGE_PRICE_ID_CORE`
- `STRIPE_OVERAGE_PRICE_ID_PRO`

## Requirements

- Stripe CLI installed and authenticated (`stripe login`)
- `jq` installed

## Run

```bash
npm run stripe:list-price-env
```

You can write the output directly into a dotenv-style file:

```bash
npm run stripe:list-price-env > stripe-pricing.env
```

The script matches prices using Stripe price metadata from `scripts/stripe-setup-new-plans.js`:

- `metadata.plan_key` in `{night_weekend,lite,core,pro}`
- `metadata.price_type` in `{base,overage}`
- `recurring.usage_type` checks (`licensed` for base, `metered` for overage)
