# Error Codes Reference

Quick reference for RingSnap error codes and their user-facing messages.

## Payment Errors

| Error Code | User Message | Suggested Action | Retryable |
|------------|--------------|------------------|-----------|
| `CARD_DECLINED` | Your card was declined. Please try a different card. | Try a different payment method | ✅ Yes |
| `CARD_NOT_SUPPORTED` | This card was declined by your bank. Please try a different card or contact your bank. | Try a different payment method | ✅ Yes |
| `CARD_EXPIRED` | Your card has expired. Please use a valid card. | Update your payment method | ✅ Yes |
| `INSUFFICIENT_FUNDS` | Your card was declined due to insufficient funds. Please try a different card. | Try a different payment method | ✅ Yes |
| `INCORRECT_CVC` | The security code (CVC) was incorrect. Please check and try again. | Verify your card security code | ✅ Yes |
| `PAYMENT_AUTH_REQUIRED` | Your card requires additional verification. Please try a different card. | Try a different payment method | ✅ Yes |
| `PAYMENT_PROCESSOR_ERROR` | We could not process your payment. Please try again or use a different card. | Try again or contact support | ✅ Yes |

## Account Errors

| Error Code | User Message | Suggested Action | Retryable |
|------------|--------------|------------------|-----------|
| `ACCOUNT_EXISTS` | An account with this email already exists. Please log in instead. | Log in with existing account | ❌ No |
| `INVALID_EMAIL` | Please use a valid business or personal email address. | Use a different email | ✅ Yes |
| `INVALID_PHONE` | Invalid phone number format. | Check phone number | ✅ Yes |
| `RATE_LIMIT_EXCEEDED` | Trial limit reached. You've already created a trial recently. | Contact support | ❌ No |

## System Errors

| Error Code | User Message | Suggested Action | Retryable |
|------------|--------------|------------------|-----------|
| `INTERNAL_ERROR` | We hit a snag while creating your trial. Please try again in a moment. | Try again or contact support | ✅ Yes |
| `SERVICE_UNAVAILABLE` | Our service is temporarily unavailable. Please try again in a few minutes. | Try again later | ✅ Yes |
| `VALIDATION_ERROR` | Invalid input data. Please check your information and try again. | Review and correct input | ✅ Yes |

## Stripe Test Cards

Use these test cards to trigger specific error scenarios:

| Card Number | Scenario | Expected Error Code |
|-------------|----------|---------------------|
| `4000000000000002` | Generic decline | `CARD_DECLINED` |
| `4000000000009995` | Insufficient funds | `INSUFFICIENT_FUNDS` |
| `4000000000000069` | Expired card | `CARD_EXPIRED` |
| `4000000000000127` | Incorrect CVC | `INCORRECT_CVC` |
| `4000000000000101` | Requires authentication | `PAYMENT_AUTH_REQUIRED` |
| `4242424242424242` | Success (any CVC, future expiry) | N/A |

## Error Response Structure

All errors follow this structure:

```typescript
{
  success: false,
  errorCode: "CARD_DECLINED",
  userMessage: "Your card was declined. Please try a different card.",
  debugMessage: "Stripe error: card_declined - Your card was declined.",
  correlationId: "3088d81c-a212-4947-ac65-25b6f1290bac",
  phase: "stripe_payment_method",
  retryable: true,
  suggestedAction: "Try a different payment method"
}
```

## Frontend Usage

```typescript
import { extractUserError, logClientError } from '@/lib/errors';

try {
  const { data, error } = await supabase.functions.invoke('create-trial', { body });
  
  if (error || !data?.success) {
    const appError = extractUserError(data || error);
    
    // Log for debugging
    logClientError('Trial Creation', appError, { email: body.email });
    
    // Show to user
    if (appError.retryable) {
      showError(appError.userMessage, appError.suggestedAction);
    } else {
      showError(appError.userMessage);
      redirectToLogin();
    }
  }
} catch (err) {
  // Handle unexpected errors
  const appError = extractUserError(err);
  showError(appError.userMessage);
}
```

## Backend Usage

```typescript
// In create-trial edge function
try {
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
} catch (e: any) {
  // Log full technical details
  logError("Stripe payment method attach failed", {
    ...baseLogOptions,
    error: e,
    context: { phase: "stripe_payment_method" }
  });
  
  // Return user-friendly error
  const errorResponse = mapStripeErrorToUserError(e, "stripe_payment_method");
  return new Response(JSON.stringify(errorResponse), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
```

## Adding New Error Codes

1. Add to `ErrorCode` type in both backend and frontend
2. Add mapping in `mapStripeErrorToUserError()` or equivalent
3. Add to this reference document
4. Add test case
5. Update documentation

## Monitoring

### Supabase Logs Query
```sql
-- Find errors by code
SELECT * FROM edge_logs 
WHERE function_name = 'create-trial' 
  AND level = 'error'
  AND event_message::json->>'errorCode' = 'CARD_DECLINED'
ORDER BY timestamp DESC
LIMIT 100;

-- Find errors by correlation ID
SELECT * FROM edge_logs 
WHERE event_message::json->>'correlationId' = '3088d81c-...'
ORDER BY timestamp ASC;
```

### Client-Side Logging
All errors are logged to console with:
- Error code
- Correlation ID
- Phase
- Debug message
- Timestamp

---

**Last Updated:** 2025-12-11  
**Maintained By:** RingSnap Engineering Team
