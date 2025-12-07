# Assistant Templates & Prompt Management

RingSnap uses a template system to generate and manage the "System Prompts" for Vapi assistants.

## Overview
- **Default Generation**: When an account is provisioned, a default template is generated based on the account's Trade, Service Area, and Services.
- **Storage**: Templates are stored in the `assistant_templates` table.
- **Per-Account Customization**: Each account has its own template copy. Editing this template updates the specific assistant without affecting others.

## Data Model
**Table**: `assistant_templates`
- `id`: UUID
- `account_id`: UUID
- `trade`: String (e.g., 'plumbing', 'hvac')
- `template_body`: Text (The full system prompt)
- `is_default`: Boolean (True if this is the active default for the trade)
- `source`: 'system_generated' | 'custom'

## Helper Functions (`supabase/functions/_shared/template-service.ts`)

### `getAccountTemplate(supabase, accountId, trade)`
Retrieves the active template for an account. Prefers templates where `is_default` is true.

### `upsertAccountTemplate(supabase, accountId, trade, templateBody, source)`
Saves a new template or updates the existing one. Used during provisioning and can be used by future UI editors.

## Future UI & Guardrails
When building a staff or customer-facing UI to edit these prompts, follow these guidelines:

1. **Use the Helpers**: Always use `upsertAccountTemplate` to save changes.
2. **Output Format**: Ensure the UI preserves the Markdown-like structure (`[Identity]`, `[Response Guidelines]`, etc.) as these headers help the LLM navigate the instructions.
3. **Restricted Sections**: 
   - Consider making the `[Identity]` and `[Error Handling]` sections read-only to prevent breaking the core persona.
   - Allow free editing of `[Response Guidelines]`, `[FAQs]`, and `[Trade Knowledge]`.
4. **Validation**:
   - Prevent empty templates.
   - Warn if `{company_name}` or other critical placeholders are removed.
   - Limit total character count if Vapi has limits (though GPT-4 context is large).
