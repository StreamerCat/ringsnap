import { CallOutcome } from "./integration-types.ts";

export interface JobberTokens {
    access_token: string;
    refresh_token?: string;
}

export class JobberClient {
    private baseUrl = "https://api.getjobber.com/api/graphql";

    constructor(private tokens: JobberTokens) { }

    private async request(query: string, variables: any = {}) {
        const response = await fetch(this.baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.tokens.access_token}`,
                "X-Jobber-GraphQL-Version": "2023-11-15", // Pinning a recent version
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            // Handle 401 specifically for token expiry if needed, but for now just throw
            const text = await response.text();
            throw new Error(`Jobber API error: ${response.status} ${text}`);
        }

        const json = await response.json();
        if (json.errors) {
            throw new Error(`Jobber GraphQL error: ${JSON.stringify(json.errors)}`);
        }

        return json.data;
    }

    async getOrCreateClient(params: {
        name?: string | null;
        phone: string;
        email?: string | null;
    }): Promise<{ id: string }> {
        // 1. Search by Phone (simplest unique identifier for callers)
        // Jobber's search strictly might not support phone directly in one go, 
        // but we can query `clients` with `searchTerm`.
        const searchParams = params.phone.replace(/[^\d]/g, ''); // Simplistic normalization

        const searchQuery = `
      query SearchClients($searchTerm: String!) {
        clients(first: 1, searchTerm: $searchTerm) {
          nodes {
            id
            phones {
              number
            }
          }
        }
      }
    `;

        const searchResult = await this.request(searchQuery, { searchTerm: params.phone });
        const existing = searchResult.clients?.nodes?.[0];

        if (existing) {
            return { id: existing.id };
        }

        // 2. Create if not found
        const createQuery = `
      mutation CreateClient($input: ClientInput!) {
        clientCreate(client: $input) {
          client {
            id
          }
          userErrors {
            message
            path
          }
        }
      }
    `;

        const nameParts = (params.name || "Unknown Caller").split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || "Unknown";

        const input: any = {
            firstName,
            lastName,
            phones: [{ number: params.phone, primary: true }],
        };
        if (params.email) {
            input.emails = [{ address: params.email, primary: true }];
        }

        const createResult = await this.request(createQuery, { input });

        if (createResult.clientCreate?.userErrors?.length > 0) {
            throw new Error(`Failed to create client: ${JSON.stringify(createResult.clientCreate.userErrors)}`);
        }

        return { id: createResult.clientCreate?.client?.id };
    }

    async createJobOrRequest(params: {
        clientId: string;
        outcome: CallOutcome;
        summary: string;
    }): Promise<{ id: string; type: 'job' | 'request' } | null> {

        const title = `RingSnap Call: ${params.outcome.replace('_', ' ')}`;
        const description = params.summary;

        if (params.outcome === 'booking_created') {
            const mutation = `
            mutation CreateJob($input: CreateJobInput!) {
                jobCreate(input: $input) {
                    job { id }
                    userErrors { message }
                }
            }
        `;
            // Correct payload for Jobber Job creation can be complex. 
            // We'll trust standard required fields: client, title/description.
            // Note: Jobber API often requires property id (client id).
            const input = {
                clientId: params.clientId,
                title,
                description,
                // Defaults or minimal
            };
            const result = await this.request(mutation, { input });
            if (result.jobCreate?.userErrors?.length > 0) {
                throw new Error(`Failed to create job: ${JSON.stringify(result.jobCreate.userErrors)}`);
            }
            return { id: result.jobCreate.job.id, type: 'job' };

        } else if (params.outcome === 'new_lead' || params.outcome === 'quote_requested') {
            const mutation = `
            mutation CreateRequest($input: RequestInput!) {
                requestCreate(request: $input) {
                    request { id }
                    userErrors { message }
                }
            }
        `;
            const input = {
                client: params.clientId, // Note: sometimes it's 'client' or 'clientId' depending on API version. Jobber uses 'client' for RequestInput mostly.
                title,
                description,
                assessment: {
                    instructions: description
                }
            };
            // Fix Client ID format if needed (e.g. from GraphQL ID to int) - Jobber uses GraphQL IDs (base64) so raw string should be fine usually.
            // Actually Jobber RequestInput takes 'client: "gid://..."'

            const result = await this.request(mutation, { input });
            if (result.requestCreate?.userErrors?.length > 0) {
                throw new Error(`Failed to create request: ${JSON.stringify(result.requestCreate.userErrors)}`);
            }
            return { id: result.requestCreate.request.id, type: 'request' };
        }

        return null; // No object for missed_call or generic known customer
    }

    async addNote(params: {
        subjectId: string; // Client ID, Job ID, or Request ID
        note: string;
    }): Promise<void> {
        const mutation = `
      mutation AddNote($input: NoteInput!) {
        noteCreate(note: $input) {
          note { id }
          userErrors { message }
        }
      }
    `;
        // Jobber NoteInput: { subject: ID!, message: String! }
        const input = {
            subject: params.subjectId,
            message: params.note,
        };

        const result = await this.request(mutation, { input });
        if (result.noteCreate?.userErrors?.length > 0) {
            throw new Error(`Failed to add note: ${JSON.stringify(result.noteCreate.userErrors)}`);
        }
    }
}
