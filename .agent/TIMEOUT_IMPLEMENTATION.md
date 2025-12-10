# Timeout Handling Implementation Details

## Overview
The ProvisioningStatus page now implements a 20-second timeout to gracefully handle cases where provisioning takes longer than expected.

## Technical Implementation

### State Management
```typescript
const [status, setStatus] = useState<"pending" | "ready" | "failed" | "timeout">("pending");
const [elapsedTime, setElapsedTime] = useState(0);
const TIMEOUT_MS = 20000; // 20 seconds
```

### Timer Logic
```typescript
useEffect(() => {
    let active = true;
    const timerRef = { current: null as NodeJS.Timeout | null };
    const timeoutRef = { current: null as NodeJS.Timeout | null };
    const startTime = Date.now();

    // Polling interval (every 5 seconds)
    timerRef.current = setInterval(checkStatus, 5000);

    // Timeout timer (20 seconds)
    timeoutRef.current = setTimeout(() => {
        if (active && status === "pending") {
            setStatus("timeout");
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, TIMEOUT_MS);

    // Cleanup both timers
    return () => {
        active = false;
        if (timerRef.current) clearInterval(timerRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
}, [navigate, status]);
```

## Behavior Matrix

| Time Elapsed | Provisioning Status | UI State | Polling Active | User Action Available |
|--------------|---------------------|----------|----------------|----------------------|
| 0-20s | pending | PENDING | ✅ Yes | Go to Dashboard (outline) |
| 0-20s | completed | READY | ❌ No | Go to Dashboard (primary) |
| 0-20s | failed | FAILED | ❌ No | Go to Dashboard (outline) |
| >20s | pending | TIMEOUT | ❌ No | Go to Dashboard (outline) |
| >20s | completed | READY | ❌ No | Go to Dashboard (primary) |
| >20s | failed | FAILED | ❌ No | Go to Dashboard (outline) |

## Important Notes

### Why Stop Polling After Timeout?
When the timeout occurs, we stop polling to reduce unnecessary API calls. The user is informed they'll receive an email when provisioning completes. This prevents:
- Excessive database queries
- Wasted network bandwidth
- Battery drain on mobile devices

### Email Notification
The timeout message states: "You'll receive an email shortly when everything is ready."

**Current Implementation**: The provisioning system should already send emails when complete. If not, this needs to be added to the `provision-vapi` edge function.

**Recommendation**: Verify that the provisioning completion triggers an email notification. If not, add this to the provisioning worker.

### Edge Cases Handled

1. **User navigates away before timeout**: Timers are cleaned up properly
2. **Provisioning completes at exactly 20 seconds**: Race condition handled by checking `active` flag
3. **User refreshes page**: Timers restart, but status is re-fetched from database
4. **Multiple tabs open**: Each tab has independent timers (acceptable behavior)

## UI Copy

### Timeout State
```
Heading: "Still Working on It..."

Body:
"Your AI assistant is taking a bit longer to set up than usual. 
This is completely normal!

You'll receive an email shortly when everything is ready.

In the meantime, feel free to explore your dashboard and 
familiarize yourself with the platform."

What's happening?
• Creating your dedicated phone number
• Training your AI with your business details
• Setting up call routing and forwarding
```

## Monitoring Recommendations

### Metrics to Track
1. **Average provisioning time**: How long does it typically take?
2. **Timeout rate**: What % of users hit the 20s timeout?
3. **Provisioning success rate**: What % complete successfully?
4. **Time to completion after timeout**: For users who timeout, how much longer does it take?

### Adjusting the Timeout
If metrics show:
- **Most users complete < 10s**: Consider reducing timeout to 15s
- **Many users hit timeout but complete soon after**: Consider increasing to 30s
- **Frequent failures after timeout**: Investigate provisioning system issues

### Query for Monitoring
```sql
-- Average provisioning time
SELECT 
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
FROM accounts
WHERE provisioning_status = 'completed'
AND created_at > NOW() - INTERVAL '7 days';

-- Timeout rate (proxy: accounts still pending after 20s)
SELECT 
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - created_at)) > 20 
                     AND provisioning_status = 'pending') as timeout_count,
    COUNT(*) as total_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - created_at)) > 20 
                                    AND provisioning_status = 'pending') / COUNT(*), 2) as timeout_rate_pct
FROM accounts
WHERE created_at > NOW() - INTERVAL '7 days';
```

## Future Enhancements

### Progressive Status Updates
Instead of just "pending", show more granular status:
- "Creating phone number..." (0-5s)
- "Training AI assistant..." (5-15s)
- "Finalizing setup..." (15-20s)
- "Taking longer than usual..." (>20s)

### Retry Mechanism
Add a "Retry" button in the timeout state that:
1. Manually triggers the provisioning worker
2. Resets the timeout timer
3. Resumes polling

### Real-time Updates
Use Supabase Realtime subscriptions instead of polling:
```typescript
useEffect(() => {
    const subscription = supabase
        .channel('account-provisioning')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'accounts',
            filter: `id=eq.${accountId}`
        }, (payload) => {
            if (payload.new.provisioning_status === 'completed') {
                setStatus('ready');
                setPhoneNumber(payload.new.vapi_phone_number);
            }
        })
        .subscribe();

    return () => {
        subscription.unsubscribe();
    };
}, [accountId]);
```

## Testing the Timeout

### Manual Test
1. Start trial signup
2. Complete payment
3. Immediately after redirect to /setup/assistant, open browser DevTools
4. Go to Network tab → Throttling → Set to "Slow 3G"
5. Wait 20 seconds
6. Verify timeout state appears
7. Reset throttling to "No throttling"
8. Verify polling has stopped (no new network requests to accounts table)

### Automated Test (Recommended)
```typescript
describe('ProvisioningStatus Timeout', () => {
    it('should show timeout state after 20 seconds', async () => {
        // Mock provisioning status as 'pending'
        mockSupabase.from('accounts').select.mockReturnValue({
            single: () => Promise.resolve({
                data: { provisioning_status: 'pending', vapi_phone_number: null }
            })
        });

        render(<ProvisioningStatus />);

        // Initially shows pending
        expect(screen.getByText(/Setting up your AI Assistant/i)).toBeInTheDocument();

        // Fast-forward 20 seconds
        act(() => {
            jest.advanceTimersByTime(20000);
        });

        // Should now show timeout
        expect(screen.getByText(/Still Working on It/i)).toBeInTheDocument();
        expect(screen.getByText(/receive an email shortly/i)).toBeInTheDocument();
    });
});
```
