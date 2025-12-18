# Security & Privacy

RingSnap is committed to protecting your business data and your customers' information. This document outlines our security practices, data handling policies, and privacy commitments.

---

## Overview

| Commitment | Status |
|------------|--------|
| **Data Encryption** | ✅ In transit and at rest |
| **HIPAA Compliance** | ✅ Available |
| **SOC 2 Type II** | 🔄 In progress |
| **GDPR Compliant** | ✅ Yes |
| **Data Isolation** | ✅ Per-account isolation |
| **99.9% Uptime SLA** | ✅ Guaranteed |

---

## How We Handle Calls

### Call Processing

When a customer calls your RingSnap number:

1. **Call Arrives** → Encrypted connection established
2. **AI Processes** → Conversation handled in real-time
3. **Data Captured** → Call details saved to your account only
4. **Logs Generated** → Transcript and summary created
5. **Notifications Sent** → You're notified as configured

### What We Capture

| Data Type | Stored | Retention |
|-----------|--------|-----------|
| Caller phone number | Yes | Account lifetime |
| Call duration | Yes | Account lifetime |
| Call transcript | Yes | Account lifetime |
| Call summary | Yes | Account lifetime |
| Call recording (if enabled) | Yes | 90 days default |
| Appointment details | Yes | Account lifetime |

### What We DON'T Do

- ❌ Share your calls with other businesses
- ❌ Use your call data to train AI for other customers
- ❌ Sell or monetize your customer data
- ❌ Access your calls without authorization
- ❌ Store payment information (handled by Stripe)

---

## Data Isolation

### Per-Account Separation

Your data is completely isolated from other RingSnap customers:

- **Separate databases** for each account
- **Unique encryption keys** per account
- **No cross-account data access**
- **Individual audit logs**

### What This Means

- Other contractors cannot see your calls
- Your customer list is private to you
- Your custom instructions aren't shared
- Your call recordings are accessible only to you

---

## Call Recording

### Recording Availability

Call recording is available on **Professional** and **Premium** plans.

### Legal Compliance

Before enabling recording:

1. You must accept our recording consent
2. We display your state's consent requirements
3. The AI discloses recording to callers as required by law
4. One-party vs two-party consent is handled appropriately

### State Consent Types

| Consent Type | States | Requirement |
|--------------|--------|-------------|
| **One-Party** | Most states | One party (RingSnap) must consent |
| **Two-Party** | CA, FL, IL, others | Both parties must be notified |

When two-party consent is required, the AI says:
> "This call may be recorded for quality purposes."

### Recording Storage

- Recordings stored with AES-256 encryption
- Default retention: 90 days
- Extended retention available on request
- Recordings deleted permanently after retention period

### Accessing Recordings

- Only authorized users on your account
- Accessible via dashboard or API (Premium)
- Download available for local archival

---

## Data Encryption

### In Transit

All data is encrypted in transit using:

- **TLS 1.3** for all API connections
- **HTTPS** for dashboard access
- **Encrypted voice channels** for calls

### At Rest

All stored data is encrypted using:

- **AES-256** encryption
- **Separate encryption keys** per account
- **Encrypted database backups**

---

## Infrastructure Security

### Hosting

- Enterprise-grade cloud infrastructure
- SOC 2 compliant data centers
- Geographic redundancy
- 24/7 infrastructure monitoring

### Network Security

- Web Application Firewall (WAF)
- DDoS protection
- Intrusion detection
- Regular penetration testing

### Access Control

- Role-based access control (RBAC)
- Multi-factor authentication for staff
- Principle of least privilege
- Audit logging for all access

---

## Your Account Security

### Authentication

- Secure password requirements
- Session management
- Automatic session timeout
- Password reset via verified email

### Team Member Access

- Invite-only team access
- Role-based permissions (Owner, Admin, Member)
- Ability to revoke access instantly
- Activity audit logs

### API Security

- Unique API keys per account
- Keys can be revoked anytime
- Rate limiting to prevent abuse
- All API calls logged

---

## Data Retention

### Default Retention Periods

| Data Type | Retention |
|-----------|-----------|
| Call logs | Account lifetime |
| Transcripts | Account lifetime |
| Recordings | 90 days |
| Appointments | Account lifetime |
| Leads | Account lifetime |
| Billing records | 7 years (legal requirement) |

### After Account Cancellation

| Data Type | Deleted After |
|-----------|---------------|
| Call logs | 30 days |
| Recordings | Immediately |
| Transcripts | 30 days |
| Personal data | 30 days |
| Billing records | Retained per legal requirements |

### Data Export

Before canceling, you can export:
- Call logs (CSV)
- Appointments (CSV)
- Leads (CSV)
- Recordings (audio files)

Contact support@getringsnap.com to request an export.

---

## Compliance

### HIPAA

For healthcare-adjacent services:
- Business Associate Agreement (BAA) available
- PHI handling procedures
- Audit controls
- Contact compliance@getringsnap.com

### GDPR

For EU data subjects:
- Right to access
- Right to deletion
- Right to data portability
- Data Processing Agreement available

### CCPA

For California residents:
- Right to know
- Right to delete
- Right to opt-out
- Non-discrimination

---

## Incident Response

### If a Security Incident Occurs

1. **Detection** → Automated monitoring alerts team
2. **Containment** → Immediate isolation of affected systems
3. **Assessment** → Determine scope and impact
4. **Notification** → Affected customers notified within 72 hours
5. **Remediation** → Fix and prevent recurrence
6. **Review** → Post-incident analysis and improvements

### Reporting Security Issues

If you discover a security vulnerability:

**Email**: security@getringsnap.com

Please include:
- Description of the issue
- Steps to reproduce
- Potential impact

We take all reports seriously and will respond within 48 hours.

---

## Third-Party Services

### What We Use

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| Stripe | Payment processing | Payment info only |
| Google Calendar | Appointment sync | Appointment details |
| SendGrid | Email notifications | Email addresses |
| AWS | Infrastructure | All data (encrypted) |

### Third-Party Security

All third-party providers:
- Are SOC 2 compliant or equivalent
- Sign data processing agreements
- Are regularly vetted for security
- Handle the minimum data necessary

---

## Your Responsibilities

### Account Security

- Use strong, unique passwords
- Don't share login credentials
- Remove team members when appropriate
- Report suspicious activity immediately

### Customer Data

- Obtain necessary consents for recording
- Comply with applicable privacy laws
- Don't store sensitive data in call notes inappropriately

---

## Frequently Asked Security Questions

### Can RingSnap employees access my calls?

Access is strictly limited and logged. Support staff may access call metadata (not recordings) only when troubleshooting issues you report.

### Is my customer data used to improve AI for others?

No. Your call data is never used to train models for other customers. Each account's data is completely isolated.

### What happens if RingSnap is acquired?

Our privacy policy requires any acquiring company to honor existing data commitments or provide you the option to delete data.

### How do I delete all my data?

Contact support@getringsnap.com with the subject "Data Deletion Request." All data will be deleted within 30 days.

### Are emergency calls private?

Yes. Emergency calls that are transferred follow the same security protocols. Only you receive the call.

---

## Contact

### Security Team

**Email**: security@getringsnap.com

### Compliance Questions

**Email**: compliance@getringsnap.com

### Privacy Requests

**Email**: privacy@getringsnap.com

---

*RingSnap — Your data, protected.*
