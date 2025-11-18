# 🎨 Form Preview Guide

## How to Access the Preview Page

The new form components are now available for preview at:

```
http://localhost:5173/form-preview
```

(Or whatever your dev server URL is)

---

## 🧪 What You Can Test

### 1. Smart Email Detection ✨

**Try this:**
1. Go to the email field
2. Enter a business email like: `john@acmeplumbing.com`
3. Watch the magic happen! ✨
   - Company Name auto-fills: "Acme Plumbing"
   - Website auto-fills: "https://acmeplumbing.com"

**Compare with generic emails:**
- Enter `john@gmail.com` - no auto-fill (as expected)
- Enter `sarah@yahoo.com` - no auto-fill (as expected)

### 2. Enhanced Validation Messages

**Try submitting with invalid data:**
- Leave name blank → "Please enter your full name (at least 2 characters)"
- Enter invalid email → "Please enter a valid email address (e.g., name@company.com)"
- Enter invalid phone → "Please enter a valid phone number (e.g., (555) 123-4567)"
- Enter 4-digit ZIP → "Please enter a valid 5-digit ZIP code (e.g., 90210)"

### 3. Visual Feedback

**Watch for:**
- ✅ Green checkmarks appear when fields are valid
- ❌ Red borders appear when fields are invalid
- ✨ "Auto-filled from email" indicator when smart detection triggers
- 🌟 "Recommended" badge on the Professional plan

### 4. Plan Selection

**Test the plan cards:**
- Notice the "Recommended" badge on Professional
- Click different plans to see the order summary update
- See how selected plan is highlighted with checkmark

### 5. Business Hours

**Test the schedule picker:**
- Toggle days on/off
- Set different hours for each day
- Notice how disabled days are grayed out

---

## 🔍 What to Look For

### User Experience Improvements

✅ **Fields are easier to understand**
- "Email *" → "Work Email"
- "Phone *" → "Phone Number *"
- Help text explains why we need the information

✅ **Error messages are helpful**
- Specific guidance on what's wrong
- Examples of correct format
- No confusing technical jargon

✅ **Visual feedback is immediate**
- See validation results as you type (on blur)
- Green checkmarks = confidence
- Clear error states = easy to fix

✅ **Less manual data entry**
- Business email detection saves time
- Auto-formatting for phone numbers
- Website field accepts multiple formats

---

## 📱 Mobile Testing

**Recommended:**
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or similar
4. Test the form on mobile view

**What to check:**
- Touch targets are large enough (44px minimum)
- Plan cards stack vertically on mobile
- Business hours selector is usable
- Keyboard shows correct type (numeric for phone, etc.)

---

## 🎯 Test Scenarios

### Scenario 1: Quick Signup (Business Email)
1. Enter email: `sarah@contractorplus.com`
2. Notice company name and website auto-fill
3. Fill in remaining fields
4. Select a plan
5. Fill in payment details (test card: 4242 4242 4242 4242)
6. Submit and see validation success

### Scenario 2: Manual Entry (Generic Email)
1. Enter email: `mike@gmail.com`
2. Manually fill company name and website
3. Complete the rest of the form
4. Submit

### Scenario 3: Error Testing
1. Try submitting with all fields empty
2. See helpful error messages appear
3. Fix one field at a time
4. Watch green checkmarks appear

---

## ⚠️ Important Notes

**This is a PREVIEW page:**
- ❌ No data is submitted to the server
- ❌ No Stripe charge is created
- ❌ No account is created
- ✅ Only validates the form
- ✅ Shows form data in browser console

**To see the validated data:**
1. Open browser console (F12)
2. Fill out the form completely
3. Click "Test Form Validation"
4. Check console for the output object

---

## 🆚 Compare to Production

**Side-by-side comparison:**

1. Open the preview: `http://localhost:5173/form-preview`
2. Open production in another tab: `http://localhost:5173/sales`
3. Compare:
   - Smart email detection (preview has it, production doesn't)
   - Error messages (preview is more helpful)
   - Visual feedback (preview has checkmarks)
   - Plan selection (preview has "Recommended" badge)

---

## 🐛 Known Limitations (Preview Mode)

These are intentional for the preview:
- Payment processing is disabled (no real charges)
- Form submission is mocked (2-second delay, then success)
- No database writes occur
- No Vapi provisioning happens

These limitations do NOT exist in the actual components - they're only for safe testing on the preview page.

---

## 🚀 Next Steps

After testing the preview, you can:

1. **Integrate into production** - Replace the existing SalesSignupForm with these components
2. **Add to trial flow** - Apply smart email detection to SelfServeTrialFlow
3. **Customize further** - Adjust colors, copy, or validation rules
4. **Deploy** - Push to staging/production when ready

---

## 💡 Tips

**Best test emails for smart detection:**
```
john@acmeplumbing.com     → "Acme Plumbing"
sarah@smithhvac.com       → "Smith Hvac"
mike@joe-electrician.com  → "Joe Electrician"
alex@abc_roofing.net      → "Abc Roofing"
```

**Test cards for Stripe (if enabled):**
```
4242 4242 4242 4242  → Success
4000 0000 0000 0002  → Card declined
4000 0000 0000 9995  → Insufficient funds
```

**Quick form fill (for rapid testing):**
- Name: John Smith
- Email: john@acmeplumbing.com (watch auto-fill!)
- Phone: (555) 123-4567
- Trade: Plumbing
- Service Area: Dallas Metro
- ZIP: 75001
- Emergency Policy: "Forward all after-hours calls to on-call tech"
- Sales Rep: Your Name
- Plan: Professional (recommended)
- Card: 4242 4242 4242 4242, Exp: 12/25, CVC: 123

---

## 📞 Need Help?

If something doesn't work as expected:

1. Check browser console for errors (F12 → Console tab)
2. Verify all files were committed correctly
3. Restart the dev server (`npm run dev`)
4. Clear browser cache and reload

---

**Created:** 2025-11-18
**Branch:** `claude/modernize-signup-forms-013qocYc4e6e9HCTtUR8Qi5F`
**Preview URL:** `/form-preview`
