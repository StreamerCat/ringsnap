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
- `VITE_SUPABASE_PUBLISHABLE_KEY`
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

## Support

For technical issues or questions, contact the development team.
