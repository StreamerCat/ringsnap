# Jobber Integration

The Jobber integration allows RingSnap to automatically sync call data to your Jobber account, creating Clients, Requests, and Jobs based on call outcomes.

## Connection

1. Go to **Settings > Integrations**.
2. Click **Connect Jobber**.
3. You will be redirected to Jobber to authorize the RingSnap application.
4. Once authorized, you will be redirected back to RingSnap, and the status will show "Connected".

## Automatic Sync

RingSnap syncs calls in the background. The current mapping rules are:

| RingSnap Outcome | Jobber Action |
| :--- | :--- |
| **New Lead** | Creates a **Client** (if new) and a **Request**. |
| **Quote Requested** | Creates a **Client** (if new) and a **Request**. |
| **Booking Created** | Creates a **Client** (if new) and a **Job**. |
| **Other** | Adds a **Note** to the Client with call summary. |

All synced items include a note with the call summary, outcome, and links to transcripts/recordings.

## Troubleshooting

- **Sync Failed**: Check the "Recent Activity" log in the integration settings page for error messages.
- **Not Connecting**: Ensure you are logged into the correct Jobber account. If the connection expires, click **Disconnect** and then **Connect** again.
- **Delay**: Sync happens within a few minutes of the call completing.

## Developer Notes

- The integration uses Jobber's GraphQL API.
- OAuth tokens are stored securely in `jobber_connections`.
- Logic is handled by Supabase Edge Functions (`jobber-sync`, `vapi-webhook`).
