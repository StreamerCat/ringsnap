---
name: testing-emergency-calculator
description: Test the EmergencyCalculator revenue-recovery component end-to-end. Use when verifying calculator UI, trade switching, slider interactions, or CTA modal changes.
---

# Testing EmergencyCalculator

## Overview
The EmergencyCalculator is a revenue-recovery calculator for contractors showing missed-call ROI. It may not be wired into any route — check `src/App.tsx` for an existing route first.

## Setup
1. The component lives at `src/components/EmergencyCalculator.tsx`
2. If not routed, create a temporary preview page:
   - Create `src/pages/CalculatorPreview.tsx` importing `<EmergencyCalculator />`
   - Add a lazy import + `<Route path="/calculator-preview">` in `src/App.tsx`
   - **Remove these after testing** — don't commit temporary routes
3. Run dev server: `npm run dev` (port 8080)
4. Navigate to `http://localhost:8080/calculator-preview`

## Trade Presets (from `tradeConfig`)
| Trade | Calls | Missed Rate | Job Value |
|-------|-------|-------------|----------|
| Plumbing | 240 | 38% | $1,200 |
| HVAC | 220 | 42% | $1,500 |
| Electrical | 200 | 35% | $1,100 |
| Roofing | 160 | 45% | $2,000 |

## Calculation Formulas
```
missedCalls = Math.round(monthlyCalls * (missedPercent / 100))
lostRevenue = missedCalls * avgJobValue
recoveredRevenue = Math.round(lostRevenue * 0.95)
aiCost = calls <= 150 ? 59 : calls <= 300 ? 129 : calls <= 600 ? 229 : 449
netGain = recoveredRevenue - aiCost
roi = Math.round((netGain / aiCost) * 100)
paybackDays = Math.max(1, Math.round((aiCost / recoveredRevenue) * 30))
breakEvenJobs = Math.max(1, Math.ceil(aiCost / Math.max(avgJobValue, 1)))
```

## Key Test Cases
1. **Default state**: Plumbing selected, verify all slider values + computed metrics match formulas
2. **Trade switching**: Click each trade button, verify ALL sliders reset to preset values AND metrics recalculate
3. **Slider interaction**: Drag any slider, verify hero metric and all cards update in real-time
4. **CTA modal**: Click "Get your recovery plan" → EmailCaptureModal should open with Name/Email/Business fields and recovery values
5. **CSS regression**: If `index.css` elevation classes were modified, verify main landing page loads without PostCSS errors

## Known Issues
- The `rgba()` values in `index.css` elevation classes (`elevation-2/3/4`) must NOT have spaces inside Tailwind `@apply` directives (e.g., use `rgba(0,0,0,0.1)` not `rgba(0, 0, 0, 0.1)`). If this breaks, the entire site fails to render with a PostCSS error.
- The component might not be wired into any page route — always check first before assuming it's accessible.

## Devin Secrets Needed
None — this is a frontend-only component with no backend dependencies.
