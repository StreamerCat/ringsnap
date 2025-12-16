export interface CallLog {
    id: string;
    account_id: string;
    direction: 'inbound' | 'outbound';
    from_number: string | null;
    to_number: string | null;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    status: 'in-progress' | 'completed' | 'failed' | null;
    summary: string | null;
    recording_url: string | null;
    created_at: string;

    // Enhanced Fields
    caller_name: string | null;
    reason: string | null;
    outcome: 'booked' | 'lead' | 'other' | null;
    booked: boolean;
    lead_captured: boolean;
    appointment_start: string | null;
    appointment_end: string | null;
    appointment_window: string | null;
}
