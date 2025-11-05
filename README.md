# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/e3bd5ae4-7ca2-46a7-8b88-c20c969a023c

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/e3bd5ae4-7ca2-46a7-8b88-c20c969a023c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/e3bd5ae4-7ca2-46a7-8b88-c20c969a023c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Testing checklist

1. Fill the signup form with test data.
2. Expect a 200 response containing `{ ok: true, accountId }` from `/.netlify/functions/signup`.
3. Confirm the browser redirects to `/app` after submission.
4. Verify in Supabase that the `accounts` and `users` tables include the new trial records with the expected fields.
5. Ensure Lovable's native database does not contain a duplicate record for the submission.

## Admin monitoring dashboard

Operations leads and admins can access a consolidated health dashboard at `/admin/monitoring` (link available from the Sales dashboard header once authenticated as an owner or admin). The page surfaces provisioning health, usage trends, and risk signals pulled from Supabase views optimised for this workflow.

### Daily health check routine

1. **Provisioning status cards** – Confirm new accounts are progressing to a `provisioned` state and review any recent failures surfaced in the "Recent provisioning failures" table.
2. **Call volume & minutes** – Use the time range filter (7/30/90 days or all-time) to ensure total calls and minutes align with expectations. Investigate spikes in cost or average call duration.
3. **Edge function error feed** – Scan the most recent errors for repeated failures. Escalate critical or high severity issues and capture request IDs for debugging.
4. **Flagged accounts** – Review accounts with active alerts, provisioning issues, or manual flags. Coordinate follow-up actions with support or sales depending on the flagged reason.

All datasets are powered by the new `admin_*` Supabase views, so downstream teams can also build reports directly against those views if deeper analysis is required.
