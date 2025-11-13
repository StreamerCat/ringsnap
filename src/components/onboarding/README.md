# Trial Onboarding System

Dual-flow trial onboarding for RingSnap's AI phone receptionist service.

## 🎯 Overview

This system provides **two distinct onboarding flows** sharing a unified backend:

1. **Self-Serve Trial Flow** (`/trial`) - 8-step conversion-optimized flow for website visitors
2. **Sales-Guided Trial Flow** (`/onboarding/sales`) - 5-step fast flow for in-person sales reps

### Architecture Principles

- ✅ **One engine, two UX containers** - Shared backend, different frontend orchestration
- ✅ **Atomic component composition** - Reusable components assembled differently per flow
- ✅ **Zero code duplication** - DRY architecture throughout
- ✅ **Source tracking** - Differentiate self-serve vs sales for analytics
- ✅ **Stripe integration** - Reuses existing payment infrastructure 100%

## 📁 File Structure

```
src/components/onboarding/
├── shared/                          # Atomic components (reusable)
│   ├── UserInfoForm.tsx            # Name, email, phone
│   ├── BusinessBasicsForm.tsx      # Company, trade, website
│   ├── BusinessAdvancedForm.tsx    # Hours, goals, custom config
│   ├── VoiceSelector.tsx           # Male/female voice selection
│   ├── PlanSelector.tsx            # Starter/Pro/Premium plans
│   ├── PaymentForm.tsx             # Stripe CardElement + terms
│   ├── ProvisioningStatus.tsx      # Async provisioning with polling
│   └── PhoneReadyPanel.tsx         # Success screen with phone #
│
├── SelfServeTrialFlow.tsx          # 8-step self-serve orchestrator
├── SalesGuidedTrialFlow.tsx        # 5-step sales orchestrator
│
├── types.ts                         # Shared TypeScript types
├── utils.ts                         # Utility functions
├── constants.ts                     # Plans, trades, configs
├── index.ts                         # Public exports
│
├── __tests__/                       # Test suite
│   ├── utils.test.ts               # Unit tests for utilities
│   ├── UserInfoForm.test.tsx       # Component tests
│   ├── PlanSelector.test.tsx       # Component tests
│   ├── integration.test.tsx        # E2E flow tests
│   └── setup.ts                    # Test configuration
│
└── README.md                        # This file
```

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Stripe and Supabase keys
```

### Usage

```tsx
import { SelfServeTrialFlow, SalesGuidedTrialFlow } from "@/components/onboarding";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripe = loadStripe(process.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Self-serve flow
<Elements stripe={stripe}>
  <SelfServeTrialFlow
    onSuccess={() => navigate("/dashboard")}
    onError={(error) => console.error(error)}
  />
</Elements>

// Sales-guided flow
<Elements stripe={stripe}>
  <SalesGuidedTrialFlow
    onSuccess={() => navigate("/dashboard")}
  />
</Elements>
```

## 📋 Flow Comparison

| Feature | Self-Serve | Sales-Guided |
|---------|------------|--------------|
| **Steps** | 8 | 5 |
| **Duration** | ~5-7 minutes | ~3-4 minutes |
| **Data Collection** | Progressive, detailed | Fast, minimal |
| **Terms Acceptance** | Checkbox required | Rep explains verbally |
| **Provisioning UX** | Educational (explain features) | Demo-focused (pitch time) |
| **Source Tracking** | `website` | `sales` |
| **Sales Rep** | N/A | Captured |
| **Primary Goal** | Captured | Optional |

## 🧩 Atomic Components

### UserInfoForm
Collects name, email, phone.

```tsx
<UserInfoForm
  form={form}
  requiredFields={["name", "email", "phone"]}
  showLabels={true}
  compact={false}
  disabled={false}
/>
```

### BusinessBasicsForm
Collects company name, trade, website/location.

```tsx
<BusinessBasicsForm
  form={form}
  requiredFields={["companyName", "trade", "website"]}
  showOptionalBadges={true}
  disabled={false}
/>
```

### VoiceSelector
Male or female AI voice selection.

```tsx
<VoiceSelector
  form={form}
  showSamples={true}
  layout="horizontal"
  disabled={false}
/>
```

### PlanSelector
Choose Starter ($297), Professional ($497), or Premium ($797).

```tsx
<PlanSelector
  form={form}
  variant="detailed"  // or "compact"
  highlight="professional"
  disabled={false}
/>
```

### PaymentForm
Stripe CardElement with security badges.

```tsx
<PaymentForm
  onCardChange={(complete, error) => {
    setCardComplete(complete);
    setCardError(error);
  }}
  showTerms={true}
  termsAccepted={termsAccepted}
  onTermsChange={setTermsAccepted}
  disabled={false}
/>
```

### ProvisioningStatus
Polls backend for Vapi phone number provisioning (1-2 minutes).

```tsx
<ProvisioningStatus
  accountId={accountId}
  onComplete={(phoneNumber) => {
    setPhoneNumber(phoneNumber);
    setCurrentStep(nextStep);
  }}
  onError={(error) => toast.error(error)}
  showProgress={true}
  pollingInterval={3000}  // 3 seconds
/>
```

### PhoneReadyPanel
Success screen with phone number and call forwarding instructions.

```tsx
<PhoneReadyPanel
  phoneNumber="+15551234567"
  onTestCall={() => window.open(`tel:${phoneNumber}`)}
  onViewDashboard={() => navigate("/dashboard")}
  showForwardingInstructions={true}
  variant="full"  // or "minimal"
/>
```

## 🔄 Data Flow

### Self-Serve Flow

```
1. User Info → 2. Business Basics → 3. Business Advanced → 4. Voice →
5. Plan → 6. Payment → 7. Provisioning → 8. Phone Ready
                              ↓
                     create-trial endpoint
                     (source: "website")
                              ↓
              Stripe subscription + Account + Provisioning job
                              ↓
                    Vapi creates phone number
                              ↓
                      Poll for completion
                              ↓
                    Show phone number + next steps
```

### Sales-Guided Flow

```
1. Combined Form (all info) → 2. Plan → 3. Payment →
4. Provisioning → 5. Demo Ready
                              ↓
                     create-trial endpoint
                     (source: "sales")
                              ↓
              Stripe subscription + Account + Provisioning job
                              ↓
                    Vapi creates phone number
                              ↓
                    Poll for completion (faster)
                              ↓
                 Show phone number + demo instructions
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run specific test file
npm run test UserInfoForm.test.tsx

# Run integration tests
npm run test integration.test.tsx

# Run with coverage
npm run test:coverage
```

### Test Data

```javascript
import { createMockSelfServeData, createMockSalesData } from "./__tests__/setup";

const selfServeData = createMockSelfServeData();
const salesData = createMockSalesData();
```

Use Stripe test cards:
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **3D Secure:** 4000 0025 0000 3155

## 📊 Analytics

Track conversions by source:

```sql
SELECT
  source,
  COUNT(*) as trials,
  COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as conversions
FROM accounts
WHERE created_at > now() - interval '30 days'
GROUP BY source;
```

Sales rep performance:

```sql
SELECT
  sales_rep_name,
  COUNT(*) as trials,
  COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as conversions
FROM accounts
WHERE source = 'sales'
GROUP BY sales_rep_name
ORDER BY conversions DESC;
```

## 🔧 Customization

### Adding a New Field

1. **Add to types.ts:**
   ```typescript
   export interface BusinessExtended {
     // ...existing fields
     newField?: string;
   }
   ```

2. **Add to schema (orchestrator):**
   ```typescript
   const selfServeSchema = z.object({
     // ...existing fields
     newField: z.string().optional(),
   });
   ```

3. **Add to form component:**
   ```tsx
   <FormField
     control={form.control}
     name="newField"
     render={({ field }) => (
       <FormItem>
         <FormLabel>New Field</FormLabel>
         <FormControl>
           <Input {...field} />
         </FormControl>
       </FormItem>
     )}
   />
   ```

4. **Update backend** (supabase/functions/create-trial/index.ts):
   ```typescript
   const createTrialSchema = z.object({
     // ...existing fields
     newField: z.string().optional(),
   });
   ```

### Changing Plans

Edit `constants.ts`:

```typescript
export const PLANS: PlanConfig[] = [
  {
    value: "starter",
    name: "Starter",
    price: 297,  // Change price
    calls: "≤80 calls/mo",
    features: ["Feature 1", "Feature 2"],  // Update features
  },
  // ...
];
```

Update Stripe price IDs in `.env`:
```bash
VITE_STRIPE_PRICE_STARTER=price_new_starter_id
```

## 🚨 Troubleshooting

### Provisioning Stuck

Check provisioning jobs:
```sql
SELECT * FROM provisioning_jobs
WHERE account_id = 'xxx'
ORDER BY created_at DESC;
```

Retry manually:
```typescript
await supabase.functions.invoke("provision-vapi-phone", {
  body: { account_id: accountId }
});
```

### Payment Failing

- Check Stripe API keys (test vs live)
- Verify webhook is configured
- Check browser console for Stripe errors
- Test with 4242 4242 4242 4242

### Source Not Tracking

Verify migration ran:
```sql
SELECT source FROM accounts LIMIT 1;
-- Should return: website, sales, referral, or partner
```

## 🔐 Security

- ✅ Zod validation on all inputs
- ✅ Email domain checking (self-serve only)
- ✅ Rate limiting on create-trial endpoint
- ✅ Stripe handles PCI compliance
- ✅ No credit card data touches our servers

## 📚 Resources

- [Stripe Subscriptions Guide](https://stripe.com/docs/billing/subscriptions)
- [Vapi API Documentation](https://docs.vapi.ai/)
- [React Hook Form Docs](https://react-hook-form.com/)
- [Zod Schema Validation](https://zod.dev/)

## 🤝 Contributing

When adding features:
1. Maintain atomic component pattern
2. Update both flows if shared logic changes
3. Add tests for new components
4. Update this README
5. Test both self-serve and sales flows

## 📝 License

Internal RingSnap proprietary code.

---

**Questions?** Contact the engineering team.
