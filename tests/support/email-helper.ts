import axios from 'axios';

/**
 * Resend Email Helper for E2E Tests
 * Extracts links from emails sent via Resend
 */
export class EmailHelper {
    private resendApiKey: string;
    private supabaseUrl: string;
    private supabaseServiceKey: string;

    constructor() {
        this.resendApiKey = process.env.RESEND_PROD_KEY || process.env.RESEND_API_KEY || '';
        this.supabaseUrl = process.env.SUPABASE_URL || '';
        this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!this.resendApiKey || !this.supabaseUrl || !this.supabaseServiceKey) {
            console.warn('EmailHelper: Missing environment variables (RESEND_PROD_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
        }
    }

    /**
     * Polls for the latest email sent to a recipient and extracts a link
     */
    async getLatestLink(recipient: string, linkPattern: RegExp, maxAttempts = 10, delayMs = 3000): Promise<string> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`EmailHelper: Polling for email to ${recipient} (Attempt ${attempt}/${maxAttempts})...`);

                // Step 1: Query email_events table for the latest email_id
                const emailId = await this.getLatestEmailIdFromDb(recipient);

                if (emailId) {
                    // Step 2: Fetch email content from Resend API
                    const email = await this.fetchEmailContentFromResend(emailId);

                    if (email && (email.html || email.text)) {
                        const content = email.html || email.text;
                        const match = content.match(linkPattern);

                        if (match) {
                            console.log(`EmailHelper: Link found in attempt ${attempt}`);
                            return match[0];
                        }
                    }
                }
            } catch (error) {
                console.error('EmailHelper: Error during polling:', error);
            }

            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        throw new Error(`EmailHelper: Timed out waiting for email to ${recipient} with pattern ${linkPattern}`);
    }

    private async getLatestEmailIdFromDb(recipient: string): Promise<string | null> {
        const response = await axios.get(
            `${this.supabaseUrl}/rest/v1/email_events?recipient=eq.${recipient.toLowerCase()}&order=created_at.desc&limit=1`,
            {
                headers: {
                    'apikey': this.supabaseServiceKey,
                    'Authorization': `Bearer ${this.supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data?.[0]?.email_id || null;
    }

    private async fetchEmailContentFromResend(emailId: string): Promise<any> {
        const response = await axios.get(`https://api.resend.com/emails/${emailId}`, {
            headers: {
                'Authorization': `Bearer ${this.resendApiKey}`
            }
        });

        return response.data;
    }
}
