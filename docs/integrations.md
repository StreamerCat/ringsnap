# Integrations Guide

RingSnap integrates with your existing tools to streamline your workflow. This guide covers all available integrations and how to set them up.

---

## Available Integrations

| Integration | Availability | Purpose |
|-------------|--------------|---------|
| **Google Calendar** | All Plans | Appointment scheduling |
| **Zapier** | All Plans | Connect to 5,000+ apps |
| **Jobber** | All Plans | Job management sync |
| **SMS Notifications** | All Plans | Appointment confirmations |
| **API Access** | Premium Only | Custom integrations |
| **Webhooks** | Premium Only | Real-time events |

---

## Google Calendar

### What It Does

- Books appointments directly to your calendar
- Checks availability before scheduling
- Avoids double-booking
- Syncs in real-time

### Setup Steps

1. Go to **Dashboard → Settings → Integrations**
2. Click **Connect Google Calendar**
3. Sign in with your Google account
4. Grant RingSnap permission to manage your calendar
5. Select which calendar to use for appointments

### How It Works

When a caller wants to book:
1. AI asks for preferred date/time
2. Checks your Google Calendar availability
3. Books the appointment
4. Sends confirmation to caller (if SMS enabled)
5. Event appears on your calendar immediately

### Tips

- Use a dedicated calendar for RingSnap appointments
- Set buffer time between appointments in Google Calendar settings
- Enable appointment notifications in Google Calendar

---

## Zapier

### What It Does

Connect RingSnap to 5,000+ apps including:
- CRMs (Salesforce, HubSpot, Pipedrive)
- SMS tools (Twilio, SMS services)
- Spreadsheets (Google Sheets, Airtable)
- Task managers (Asana, Monday, Trello)
- Email marketing (Mailchimp, ConvertKit)

### Setup Steps

1. Create a Zapier account at [zapier.com](https://zapier.com)
2. Search for "RingSnap" in Zapier's app directory
3. Create a new Zap with RingSnap as the trigger
4. Choose your trigger event (new call, appointment booked, lead captured)
5. Connect your other apps as actions

### Common Zaps

| Trigger | Action | Use Case |
|---------|--------|----------|
| New Lead | Add to Google Sheet | Track all incoming leads |
| Appointment Booked | Create HubSpot Contact | CRM sync |
| Missed Call | Send Slack Message | Team alerts |
| New Lead | Send SMS via Twilio | Immediate follow-up |
| Call Ended | Add to Airtable | Custom reporting |

### Example: Send Leads to Google Sheets

1. **Trigger**: RingSnap → New Lead Captured
2. **Action**: Google Sheets → Create Spreadsheet Row
3. **Map Fields**:
   - Column A: Caller Name
   - Column B: Phone Number
   - Column C: Service Needed
   - Column D: Date/Time

---

## Jobber Integration

### What It Does

Sync RingSnap with your Jobber account:
- Create new clients automatically
- Schedule jobs from calls
- Access customer history during calls
- Keep all data in one place

### Setup Steps

1. Go to **Dashboard → Settings → Integrations**
2. Click **Connect Jobber**
3. Sign in to your Jobber account
4. Authorize the connection
5. Configure sync settings

### Sync Options

| Data | Direction | Notes |
|------|-----------|-------|
| New Clients | RingSnap → Jobber | Auto-create when leads captured |
| Appointments | RingSnap → Jobber | Creates draft jobs |
| Customer Info | Jobber → RingSnap | AI can reference history |

### How It Works

**New Caller Flow:**
1. Caller reaches RingSnap
2. AI captures name, phone, service needed
3. New client created in Jobber (or matched to existing)
4. Appointment scheduled creates draft job
5. You assign and confirm in Jobber

---

## SMS Notifications

### What It Does

Automatically send text messages for:
- Appointment confirmations
- Appointment reminders
- Booking updates

### Setup Steps

1. Go to **Dashboard → Settings → SMS Settings**
2. Toggle on **Appointment Confirmations**
3. Toggle on **Reminder Messages** (optional)
4. Click **Save SMS Settings**

### Message Examples

**Confirmation:**
```
Your appointment with ABC Plumbing is confirmed for 
Tuesday, Dec 19 at 2:00 PM. Reply HELP for assistance.
```

**Reminder (24 hours before):**
```
Reminder: Your appointment with ABC Plumbing is tomorrow 
at 2:00 PM. Reply C to confirm or R to reschedule.
```

### SMS Best Practices

- Keep confirmations enabled for reduced no-shows
- Reminders typically reduce no-shows by 25-40%
- Customers can reply to reschedule

---

## API Access (Premium)

### What It Does

Direct API access for custom integrations:
- Real-time call events
- Call log queries
- Appointment management
- Custom analytics

### Getting Started

1. Upgrade to **Premium** plan
2. Go to **Dashboard → Settings → API**
3. Generate an API key
4. Review API documentation

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/calls` | GET | List recent calls |
| `/calls/{id}` | GET | Get call details |
| `/appointments` | GET | List appointments |
| `/appointments` | POST | Create appointment |
| `/leads` | GET | List captured leads |

### Authentication

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.getringsnap.com/v1/calls
```

### Rate Limits

- 100 requests per minute
- 10,000 requests per day

---

## Webhooks (Premium)

### What It Does

Receive real-time HTTP notifications when events occur:
- Call started
- Call ended
- Appointment booked
- Lead captured
- Emergency transferred

### Setup Steps

1. Go to **Dashboard → Settings → Webhooks**
2. Click **Add Webhook**
3. Enter your endpoint URL
4. Select events to receive
5. Save and test

### Webhook Payload Example

```json
{
  "event": "call.ended",
  "timestamp": "2024-12-17T14:30:00Z",
  "data": {
    "call_id": "call_abc123",
    "duration_seconds": 180,
    "caller_phone": "+13035551234",
    "outcome": "appointment_booked",
    "appointment": {
      "date": "2024-12-19",
      "time": "14:00",
      "service": "Water heater repair"
    }
  }
}
```

### Available Events

| Event | Trigger |
|-------|---------|
| `call.started` | Incoming call begins |
| `call.ended` | Call completes |
| `appointment.created` | New appointment booked |
| `lead.captured` | Lead info collected |
| `emergency.transferred` | Call transferred to you |

---

## Troubleshooting Integrations

### Google Calendar not syncing

1. Disconnect and reconnect the integration
2. Verify you selected the correct calendar
3. Check that the calendar isn't at capacity
4. Ensure the Google account has edit permissions

### Zapier Zaps not triggering

1. Check that the Zap is turned "On"
2. Verify RingSnap connection is authenticated
3. Test the trigger manually in Zapier
4. Check Zapier's Task History for errors

### Jobber sync issues

1. Reconnect the integration
2. Verify your Jobber subscription is active
3. Check for duplicate clients
4. Contact support for sync conflicts

---

## Need Help?

For integration support:

**Email**: integrations@getringsnap.com

Include:
- Which integration you're using
- Steps you've taken
- Any error messages

---

*RingSnap — Works with your tools.*
