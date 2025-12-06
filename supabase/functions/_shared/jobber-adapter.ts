import { CallOutcomeEvent } from "./integration-types.ts";
import { JobberClient } from "./jobber-client.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export class JobberAdapter {
    constructor(
        private client: JobberClient,
        private accountId: string,
        private supabase: any
    ) { }

    private async logOperation(
        eventId: string,
        operation: string,
        action: () => Promise<string | void>
    ) {
        try {
            const resultId = await action();
            await this.supabase.from('jobber_sync_logs').insert({
                account_id: this.accountId,
                call_event_id: eventId,
                operation_type: operation,
                status: 'success',
                external_id: resultId || null,
            });
            return resultId;
        } catch (error) {
            console.error(`Jobber Sync Error [${operation}]:`, error);
            await this.supabase.from('jobber_sync_logs').insert({
                account_id: this.accountId,
                call_event_id: eventId,
                operation_type: operation,
                status: 'error',
                error_message: error.message,
            });
            throw error; // Rethrow to stop dependent steps
        }
    }

    async syncCallOutcome(event: CallOutcomeEvent): Promise<void> {
        try {
            console.log(`Syncing event ${event.id} to Jobber...`);

            // 1. Get or Create Client
            const clientId = (await this.logOperation(event.id!, 'get_or_create_client', async () => {
                const result = await this.client.getOrCreateClient({
                    name: event.contact_name,
                    phone: event.contact_phone,
                    email: event.contact_email,
                });
                return result.id;
            })) as string;

            // 2. Create Job or Request (depending on outcome)
            let subjectId = clientId;
            if (['new_lead', 'quote_requested', 'booking_created'].includes(event.outcome)) {
                try {
                    const workResult = (await this.logOperation(event.id!, `create_${event.outcome}`, async () => {
                        const res = await this.client.createJobOrRequest({
                            clientId,
                            outcome: event.outcome,
                            summary: event.summary
                        });
                        return res ? res.id : undefined;
                    })) as string | undefined;

                    if (workResult) subjectId = workResult;
                } catch (e) {
                    // If creating job/request fails, we fall back to attaching info to the client
                    console.warn("Failed to create job/request, attaching note to client instead.");
                }
            }

            // 3. Add Call Summary Note
            await this.logOperation(event.id!, 'add_note', async () => {
                const parts = [
                    `Call Summary: ${event.summary}`,
                    `Outcome: ${event.outcome}`,
                    `From: ${event.from_number}`,
                    `To: ${event.to_number}`,
                    `Time: ${event.occurred_at}`,
                ];
                if (event.transcript_url) parts.push(`Transcript: ${event.transcript_url}`);
                if (event.recording_url) parts.push(`Recording: ${event.recording_url}`);

                await this.client.addNote({
                    subjectId,
                    note: parts.join('\n\n')
                });
            });

        } catch (error) {
            console.error("Critical failure syncing to Jobber:", error);
            // Logs already handled in helper
        }
    }
}
