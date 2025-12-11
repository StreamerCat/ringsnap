# Error Handling + UX Hardening - Executive Summary

## 🎯 Objective

Transform RingSnap's error handling from technical/confusing to user-friendly and actionable, starting with the critical trial signup flow.

## 📊 Current Problem

**User sees this:**
> "Stripe Payment Method Attach Failed: Your card does not support this type of purchase."

**User should see this:**
> "This card was declined by your bank. Please try a different card or contact your bank."

## ✨ Solution Overview

### 1. Structured Error Contract
Create a standardized error response format:
```typescript
{
  success: false,
  errorCode: "CARD_NOT_SUPPORTED",
  userMessage: "This card was declined by your bank. Try a different card.",
  debugMessage: "Stripe Payment Method Attach Failed: ...",  // For logs only
  correlationId: "3088d81c-...",
  retryable: true,
  suggestedAction: "Try a different payment method"
}
```

### 2. Smart Error Mapping
Map Stripe errors to user-friendly messages:
- "card does not support" → "Card declined by bank"
- "card_declined" → "Card was declined"
- "insufficient funds" → "Insufficient funds"
- "expired" → "Card has expired"
- etc.

### 3. Frontend UX Improvements
- Keep user on payment step when card fails
- Show clear, actionable error message
- Provide retry option
- Log technical details silently

### 4. App-Wide Consistency
- Audit all error messages
- Replace generic "technical error" messages
- Establish shared error utility
- Document patterns for future development

## 📋 Implementation Phases

| Phase | Priority | Agent | Effort |
|-------|----------|-------|--------|
| 1. Backend (create-trial) | P1 | @signup-flow-agent | 4h |
| 2. Frontend (signup flows) | P1 | @frontend-experience-agent | 4h |
| 3. App-wide audit | P2 | @frontend-experience-agent | 6h |
| 4. Testing | P1 | @test-agent | 3h |
| 5. Documentation | P3 | @docs-agent | 2h |

**Total estimated effort:** ~19 hours

## 🚨 Risk Assessment

### High Risk
- ✅ **Mitigated:** Changes to critical signup flow
  - Strategy: Incremental deployment, extensive testing
- ✅ **Mitigated:** Backward compatibility during transition
  - Strategy: Frontend handles both old/new error formats

### Medium Risk
- Error response format changes
- Multiple signup flows to update

### Low Risk
- Documentation updates
- Shared utility creation

## ✅ Acceptance Criteria

### User Experience
- [ ] Declined card shows friendly message
- [ ] User stays on payment step with retry option
- [ ] No technical jargon or stack traces visible
- [ ] Clear next steps provided

### Technical
- [ ] All errors logged with full details + correlationId
- [ ] Structured error responses from backend
- [ ] Consistent error handling across signup flows
- [ ] No data leakage in error messages

### Testing
- [ ] All Stripe test cards produce correct messages
- [ ] Retry flow works correctly
- [ ] Logs are detailed and queryable
- [ ] Non-payment errors handled gracefully

## 📦 Deliverables

1. **Updated Edge Function:** `supabase/functions/create-trial/index.ts`
   - Structured error responses
   - Stripe error mapping
   - Enhanced logging

2. **Updated Frontend Components:**
   - `src/pages/OnboardingChat.tsx`
   - `src/components/onboarding/SelfServeTrialFlow.tsx`
   - `src/components/onboarding/SalesGuidedTrialFlow.tsx`
   - `src/components/onboarding/SalesGuidedTrialFlowEmbedded.tsx`
   - `src/pages/AISignup.tsx`
   - `src/components/SalesSignupForm.tsx`

3. **New Utility:** `src/lib/errors.ts`
   - Error extraction
   - Error logging
   - Standard error messages

4. **Documentation:** `docs/ERROR_HANDLING.md`
   - Error contract specification
   - Error codes reference
   - Frontend patterns
   - Examples

## 🔄 Rollback Plan

1. Backend: Revert `create-trial` function deployment
2. Frontend: Revert component changes via git
3. Monitor: Watch signup success rate and error logs

## 📈 Success Metrics

- **User satisfaction:** Fewer support tickets about payment errors
- **Signup completion:** Improved conversion rate
- **Developer efficiency:** Faster debugging with better logs
- **Code quality:** Consistent error handling patterns

## 🚀 Next Steps

1. **Review this spec** - Get approval for high-risk changes
2. **Create feature branch** - `feature/error-handling-ux`
3. **Phase 1: Backend** - Implement create-trial error handling
4. **Phase 2: Frontend** - Update all signup flows
5. **Testing** - Comprehensive testing with Stripe test cards
6. **Deploy to staging** - Validate in staging environment
7. **Deploy to production** - Monitor closely
8. **Phase 3: App-wide** - Audit and update remaining flows

---

## 📞 Questions Before Starting?

- Are you comfortable with changes to the `create-trial` edge function?
- Should we deploy backend first, then frontend? (Recommended)
- Any specific error scenarios you want prioritized?
- Any specific flows beyond signup that need immediate attention?

**Ready to proceed?** Reply with approval and I'll begin Phase 1 implementation.
