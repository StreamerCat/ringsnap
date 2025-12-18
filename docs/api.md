# RingSnap API Documentation

The RingSnap API allows Premium plan customers to integrate call data, appointments, and leads directly into their systems.

---

## Overview

| Item | Details |
|------|---------|
| **Base URL** | `https://api.getringsnap.com/v1` |
| **Authentication** | Bearer token |
| **Format** | JSON |
| **Rate Limits** | 100 requests/minute, 10,000/day |
| **Availability** | Premium plan only |

---

## Authentication

All API requests require a Bearer token in the Authorization header.

### Getting Your API Key

1. Go to **Dashboard → Settings → API**
2. Click **Generate API Key**
3. Copy and store securely (shown only once)

### Using Your Key

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.getringsnap.com/v1/calls
```

### Key Management

- Keys can be revoked and regenerated
- One active key per account
- Keys never expire (until revoked)

---

## Endpoints

### Calls

#### List Recent Calls

```
GET /calls
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Max results (1-100) |
| `offset` | integer | 0 | Pagination offset |
| `start_date` | string | 30 days ago | ISO 8601 date |
| `end_date` | string | now | ISO 8601 date |
| `status` | string | all | Filter: `completed`, `missed`, `transferred` |

**Example Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.getringsnap.com/v1/calls?limit=10&status=completed"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "calls": [
      {
        "id": "call_abc123",
        "started_at": "2024-12-18T14:30:00Z",
        "ended_at": "2024-12-18T14:34:22Z",
        "duration_seconds": 262,
        "caller_phone": "+13035551234",
        "status": "completed",
        "outcome": "appointment_booked",
        "transcript_summary": "Customer called about water heater not heating. Scheduled appointment for tomorrow at 2 PM.",
        "recording_url": "https://recordings.ringsnap.com/call_abc123.mp3"
      }
    ],
    "pagination": {
      "total": 156,
      "limit": 10,
      "offset": 0,
      "has_more": true
    }
  }
}
```

---

#### Get Call Details

```
GET /calls/{call_id}
```

**Example Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.getringsnap.com/v1/calls/call_abc123
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "call_abc123",
    "started_at": "2024-12-18T14:30:00Z",
    "ended_at": "2024-12-18T14:34:22Z",
    "duration_seconds": 262,
    "caller_phone": "+13035551234",
    "caller_name": "John Smith",
    "status": "completed",
    "outcome": "appointment_booked",
    "transcript_summary": "Customer called about water heater not heating. Scheduled appointment for tomorrow at 2 PM.",
    "transcript_full": "AI: Thank you for calling ABC Plumbing, how can I help you today?\nCaller: Hi, my water heater isn't producing hot water...",
    "recording_url": "https://recordings.ringsnap.com/call_abc123.mp3",
    "appointment": {
      "date": "2024-12-19",
      "time": "14:00",
      "service_type": "Water heater repair",
      "notes": "No hot water since this morning"
    }
  }
}
```

---

### Appointments

#### List Appointments

```
GET /appointments
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Max results (1-100) |
| `offset` | integer | 0 | Pagination offset |
| `start_date` | string | today | ISO 8601 date |
| `end_date` | string | +30 days | ISO 8601 date |
| `status` | string | all | Filter: `scheduled`, `completed`, `cancelled` |

**Example Response:**

```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "apt_xyz789",
        "call_id": "call_abc123",
        "customer_name": "John Smith",
        "customer_phone": "+13035551234",
        "scheduled_date": "2024-12-19",
        "scheduled_time": "14:00",
        "service_type": "Water heater repair",
        "status": "scheduled",
        "notes": "No hot water since this morning",
        "created_at": "2024-12-18T14:34:22Z"
      }
    ],
    "pagination": {
      "total": 23,
      "limit": 50,
      "offset": 0,
      "has_more": false
    }
  }
}
```

---

#### Get Appointment Details

```
GET /appointments/{appointment_id}
```

---

#### Create Appointment

```
POST /appointments
```

**Request Body:**

```json
{
  "customer_name": "Jane Doe",
  "customer_phone": "+13035559876",
  "scheduled_date": "2024-12-20",
  "scheduled_time": "10:00",
  "service_type": "AC tune-up",
  "notes": "Annual maintenance"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "apt_new456",
    "customer_name": "Jane Doe",
    "customer_phone": "+13035559876",
    "scheduled_date": "2024-12-20",
    "scheduled_time": "10:00",
    "service_type": "AC tune-up",
    "status": "scheduled",
    "notes": "Annual maintenance",
    "created_at": "2024-12-18T16:00:00Z"
  }
}
```

---

#### Update Appointment

```
PATCH /appointments/{appointment_id}
```

**Request Body (partial update):**

```json
{
  "scheduled_date": "2024-12-21",
  "scheduled_time": "11:00",
  "notes": "Rescheduled per customer request"
}
```

---

#### Cancel Appointment

```
DELETE /appointments/{appointment_id}
```

---

### Leads

#### List Leads

```
GET /leads
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Max results (1-100) |
| `offset` | integer | 0 | Pagination offset |
| `start_date` | string | 30 days ago | ISO 8601 date |
| `status` | string | all | Filter: `new`, `contacted`, `converted` |

**Example Response:**

```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": "lead_def456",
        "call_id": "call_ghi789",
        "name": "Sarah Johnson",
        "phone": "+13035554321",
        "email": "sarah@example.com",
        "service_needed": "New AC installation",
        "notes": "3-bedroom home, current unit is 18 years old",
        "status": "new",
        "created_at": "2024-12-18T15:00:00Z"
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 50,
      "offset": 0,
      "has_more": false
    }
  }
}
```

---

#### Update Lead Status

```
PATCH /leads/{lead_id}
```

**Request Body:**

```json
{
  "status": "contacted",
  "notes": "Called back, scheduled estimate for Friday"
}
```

---

### Account

#### Get Account Info

```
GET /account
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "acct_123",
    "company_name": "ABC Plumbing",
    "plan": "premium",
    "minutes_used": 1234,
    "minutes_included": 7000,
    "billing_period_end": "2024-12-31",
    "phone_number": "+18005551234"
  }
}
```

---

#### Get Usage Statistics

```
GET /account/usage
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | current | `current`, `last_month`, or custom range |
| `start_date` | string | - | ISO 8601 date (for custom) |
| `end_date` | string | - | ISO 8601 date (for custom) |

**Response:**

```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2024-12-01",
      "end": "2024-12-31"
    },
    "minutes_used": 1234,
    "minutes_included": 7000,
    "calls_total": 342,
    "calls_completed": 325,
    "calls_transferred": 12,
    "calls_missed": 5,
    "appointments_booked": 156,
    "leads_captured": 89,
    "average_call_duration": 217
  }
}
```

---

## Webhooks

Receive real-time notifications when events occur.

### Setting Up Webhooks

1. Go to **Dashboard → Settings → Webhooks**
2. Click **Add Webhook**
3. Enter your endpoint URL
4. Select events to receive
5. Save and test

### Available Events

| Event | Description |
|-------|-------------|
| `call.started` | Incoming call begins |
| `call.ended` | Call completes |
| `call.transferred` | Call transferred to you |
| `appointment.created` | New appointment booked |
| `appointment.cancelled` | Appointment cancelled |
| `lead.captured` | New lead info collected |

### Webhook Payload

```json
{
  "event": "call.ended",
  "timestamp": "2024-12-18T14:34:22Z",
  "data": {
    "call_id": "call_abc123",
    "duration_seconds": 262,
    "caller_phone": "+13035551234",
    "outcome": "appointment_booked",
    "appointment": {
      "id": "apt_xyz789",
      "date": "2024-12-19",
      "time": "14:00"
    }
  }
}
```

### Webhook Security

Webhooks include a signature header for verification:

```
X-RingSnap-Signature: sha256=abc123...
```

Verify by computing HMAC-SHA256 of the payload using your webhook secret.

### Retry Policy

- Failed webhooks retry 3 times
- Retry intervals: 1 min, 5 min, 30 min
- After 3 failures, webhook is paused

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "invalid_parameter",
    "message": "The 'limit' parameter must be between 1 and 100",
    "details": {
      "parameter": "limit",
      "provided": 500
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `unauthorized` | 401 | Invalid or missing API key |
| `forbidden` | 403 | Key doesn't have permission |
| `not_found` | 404 | Resource not found |
| `invalid_parameter` | 400 | Invalid request parameter |
| `rate_limited` | 429 | Too many requests |
| `server_error` | 500 | Internal server error |

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Requests per minute | 100 |
| Requests per day | 10,000 |

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1702918500
```

---

## SDKs & Libraries

Official SDKs coming soon:
- Node.js
- Python
- PHP

For now, use any HTTP client with the REST API.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | Dec 2024 | Initial API release |

---

## Support

For API support:

**Email**: api@getringsnap.com

Include:
- Your account email
- API endpoint used
- Request/response details
- Error messages

---

*RingSnap API — Build powerful integrations.*
