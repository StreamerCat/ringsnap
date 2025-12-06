export type CallOutcome =
    | 'new_lead'
    | 'existing_customer'
    | 'missed_call'
    | 'quote_requested'
    | 'booking_created';

export type CallOutcomeEvent = {
    id: string;
    occurred_at: string;      // ISO string
    from_number: string;
    to_number: string;
    contact_name?: string | null;
    contact_phone: string;
    contact_email?: string | null;
    source: 'inbound' | 'outbound';
    outcome: CallOutcome;
    summary: string;
    transcript_url?: string | null;
    recording_url?: string | null;
    tags: string[];
    account_id: string;
    created_at?: string;
};
