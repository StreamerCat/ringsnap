# Bot Access for Automated Testing

This document describes how automated testing tools (like Google Jules, Puppeteer, Playwright, etc.) can access password-protected routes in the RingSnap application.

## Overview

The `/sales` route is protected by a password gate that requires authenticated staff users with the `sales`, `platform_admin`, or `platform_owner` role. To enable automated testing and debugging without compromising security, we've implemented a secure bypass mechanism using a secret URL parameter.

## How It Works

### For Automated Testing Tools

Automated agents can access protected routes by appending a secret parameter to the URL:

```
https://your-ringsnap-domain.com/sales?bot_access=YOUR_SECRET_KEY
```

Where `YOUR_SECRET_KEY` is the value of the `VITE_JULES_SECRET` environment variable.

### Security Features

1. **Secret Validation**: The secret is validated against the `VITE_JULES_SECRET` environment variable
2. **Session Persistence**: Once validated, access is stored in `sessionStorage` for the duration of the browser session
3. **URL Cleanup**: The secret parameter is automatically removed from the URL after validation for cleaner appearance
4. **No Database Changes**: The bypass doesn't create fake users or modify any database records
5. **Backward Compatible**: All existing password gate functionality remains intact for human users

### Priority Order

The password gate checks access in this order:

1. **Bot Access (Highest Priority)**
   - Checks for `?bot_access=SECRET` URL parameter
   - Checks for existing bot access in sessionStorage

2. **Human Access (Fallback)**
   - Checks for authenticated Supabase session
   - Validates user role against `staff_roles` table

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Bot Access Secret
# Used by automated testing tools (e.g., Google Jules) to bypass password gate
# Generate a secure random string for production
VITE_JULES_SECRET="your-secure-random-secret-here"
```

**Important**: Use a strong, randomly generated secret in production. The current development secret is for testing only.

### Recommended Secret Generation

Generate a secure secret using one of these methods:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Usage Examples

### Google Jules / Browser Automation

For tools that control a browser instance:

```javascript
// Navigate to the protected route with bot access
await page.goto('https://app.getringsnap.com/sales?bot_access=YOUR_SECRET_KEY');

// After initial navigation, the secret is stored in sessionStorage
// and the URL parameter is removed, so subsequent navigations work normally:
await page.goto('https://app.getringsnap.com/sales');
```

### Puppeteer

```javascript
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch();
const page = await browser.newPage();

// Access protected route with bot secret
const botSecret = process.env.VITE_JULES_SECRET;
await page.goto(`https://app.getringsnap.com/sales?bot_access=${botSecret}`);

// Now you can interact with the page
await page.waitForSelector('h1');
const title = await page.title();
console.log(title); // "Sales Workspace - RingSnap"

await browser.close();
```

### Playwright

```javascript
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage();

// Access with bot secret
const botSecret = process.env.VITE_JULES_SECRET;
await page.goto(`https://app.getringsnap.com/sales?bot_access=${botSecret}`);

// Interact with the page
await expect(page.locator('h1')).toContainText('Experience RingSnap Live');

await browser.close();
```

### cURL Testing

Test that the page loads (though you'll get the HTML, not an interactive session):

```bash
# Set your secret
export VITE_JULES_SECRET="your-secret-here"

# Test the protected route
curl "https://app.getringsnap.com/sales?bot_access=${VITE_JULES_SECRET}"
```

**Note**: cURL will receive the HTML but won't execute JavaScript or maintain sessionStorage. This is primarily useful for verifying the endpoint is accessible.

## Implementation Details

### Modified Files

1. **`.env`** - Added `VITE_JULES_SECRET` environment variable
2. **`.env.example`** - Added documentation for the new variable
3. **`src/components/SalesPasswordGate.tsx`** - Updated to check for bot access before normal authentication

### Code Flow

```typescript
// In SalesPasswordGate.tsx
const checkAuth = async () => {
  // 1. Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const botAccessParam = urlParams.get('bot_access');

  if (BOT_SECRET && botAccessParam === BOT_SECRET) {
    // Grant access and store in sessionStorage
    sessionStorage.setItem('ringsnap_bot_access_granted', 'true');
    setHasAccess(true);
    // Remove parameter from URL
    // ...
    return;
  }

  // 2. Check sessionStorage for existing bot access
  const sessionBotAccess = sessionStorage.getItem('ringsnap_bot_access_granted');
  if (sessionBotAccess === 'true') {
    setHasAccess(true);
    return;
  }

  // 3. Fallback to normal authentication
  // ... existing Supabase auth logic ...
};
```

## Security Considerations

### What This Bypass Does NOT Affect

- ✅ Existing user authentication remains unchanged
- ✅ Database schema and permissions are untouched
- ✅ Provisioning logic is not modified
- ✅ Stripe onboarding flow works as before
- ✅ Normal users must still authenticate with email/password

### Best Practices

1. **Keep the Secret Secure**: Never commit the actual secret to version control
2. **Rotate Regularly**: Change the secret periodically in production
3. **Use Environment Variables**: Always load from environment, never hardcode
4. **HTTPS Only**: Only use this feature over HTTPS in production
5. **Monitor Access**: Consider logging bot access attempts for security monitoring

### Limitations

- Bot access bypasses the password gate but doesn't create an authenticated user session
- API calls that require authenticated users may still fail
- Some features may behave differently without a real user session

## Troubleshooting

### Bot Access Not Working

1. **Check Environment Variable**: Ensure `VITE_JULES_SECRET` is set in your `.env` file
2. **Rebuild Application**: Vite environment variables are embedded at build time - restart the dev server or rebuild
3. **Verify Secret Match**: The URL parameter must exactly match the environment variable
4. **Check Browser Console**: Look for any JavaScript errors in the browser console

### Secret Not Loading

If `BOT_SECRET` is `undefined` in the code:

```bash
# Restart the Vite dev server
npm run dev

# Or rebuild for production
npm run build
```

### Session Not Persisting

- Bot access is stored in `sessionStorage`, which clears when the browser tab is closed
- Opening in a new tab requires adding the `?bot_access=SECRET` parameter again
- To maintain access across tabs, use the same browser session or consider using `localStorage` (requires code modification)

## Testing the Implementation

### Local Development

```bash
# 1. Ensure your .env has the secret
cat .env | grep VITE_JULES_SECRET

# 2. Start the dev server
npm run dev

# 3. Open browser to
http://localhost:5173/sales?bot_access=YOUR_SECRET_FROM_ENV

# 4. You should see the sales page without the password gate
```

### Automated Test Example

```javascript
// test/sales-bot-access.spec.js
const { test, expect } = require('@playwright/test');

test('bot can access sales page with secret', async ({ page }) => {
  const botSecret = process.env.VITE_JULES_SECRET;

  // Navigate with bot access
  await page.goto(`http://localhost:5173/sales?bot_access=${botSecret}`);

  // Verify we're on the sales page, not the password gate
  await expect(page.locator('h1')).toContainText('Experience RingSnap Live');

  // Verify the URL parameter was removed
  expect(page.url()).not.toContain('bot_access');
});

test('invalid secret shows password gate', async ({ page }) => {
  // Try with wrong secret
  await page.goto('http://localhost:5173/sales?bot_access=wrong-secret');

  // Should see the password gate
  await expect(page.locator('h2')).toContainText('RingSnap Sales Command Center');
});
```

## Support

For questions or issues with bot access:

1. Check this documentation
2. Verify environment variables are set correctly
3. Check browser console for errors
4. Review the implementation in `src/components/SalesPasswordGate.tsx`
