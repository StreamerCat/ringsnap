# RingSnap AI Receptionist

Professional AI-powered answering service for contractors.

## Project Setup

### Prerequisites
- Node.js 18+ and npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd ringsnap

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Technology Stack

- **Frontend:** React 18 + TypeScript + Vite
- **UI Components:** shadcn-ui + Radix UI + Tailwind CSS
- **Backend:** Supabase (Database, Auth, Edge Functions)
- **Payment Processing:** Stripe
- **Voice AI:** Vapi.ai
- **State Management:** TanStack Query

## Project Structure

```
src/
├── components/         # React components
│   ├── ui/            # Reusable UI components
│   └── wizard/        # Signup wizard components
├── pages/             # Route pages
├── integrations/      # Third-party integrations
├── hooks/             # Custom React hooks
└── lib/              # Utility functions

supabase/
├── functions/         # Edge functions
└── migrations/        # Database migrations
```

## Environment Variables

Required environment variables are automatically configured via the Supabase integration:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `VITE_SUPABASE_PROJECT_ID`

## Deployment

The application is deployed via the Netlify platform with automatic deployments on push to main branch.

### Build Configuration
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `supabase/functions`

## Testing Checklist

1. Fill the signup form with test data
2. Verify successful account creation in database
3. Confirm browser redirects to appropriate dashboard
4. Test phone provisioning workflow
5. Verify call handling and recording functionality

## Admin Dashboard

Operations and admin users can access the monitoring dashboard at `/admin/monitoring` to review:
- Provisioning status and failures
- Call volume and minutes
- Edge function errors
- Flagged accounts requiring attention

## Sales Page & Bot Access

The `/sales` route is protected by a password gate requiring authenticated staff users. For automated testing and debugging (e.g., Google Jules), a secure bypass is available using a secret URL parameter. See [docs/BOT_ACCESS.md](docs/BOT_ACCESS.md) for detailed usage instructions.

## Support

For technical issues or questions, contact the development team.

## Google Sign in with Supabase

Follow these steps to enable Google OAuth for RingSnap across all environments.

### Google Cloud Console
1. Create or select a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Configure the OAuth consent screen as **External**. Add test users until the app is published.
3. Create OAuth client credentials of type **Web application**.
4. Add the following Authorized redirect URIs for each environment:
   - https://getringsnap.com/auth/callback
   - https://www.getringsnap.com/auth/callback (if applicable)
   - https://<your-netlify-preview-domain>/auth/callback
   - http://localhost:3000/auth/callback (local development)
5. Copy the generated Client ID and Client Secret into Supabase → Authentication → Providers → Google.

### Supabase Settings
- In Supabase **Auth → URL Configuration**, add the same callback URLs listed above.
- Enable the Google provider with the Client ID and Client Secret from Google Cloud.
- Ensure the environment variables `NEXT_PUBLIC_SUPABASE_URL`/`VITE_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`) are available in Netlify and local `.env` files.

### App Usage
- Render the `<GoogleButton />` component on the sign-in page to start OAuth.
- Supabase will redirect back to `/auth/callback`, where the authorization code is exchanged for a session before sending the user to the dashboard.

### Troubleshooting
- **redirect_uri_mismatch**: The callback URL must match exactly, including protocol and path.
- **Unpublished consent screen**: Add test users or publish the consent screen before going live.
- **Session not sticking**: Confirm cookie settings and that all callback URLs use the same domain (avoid mixing `www` and apex).
