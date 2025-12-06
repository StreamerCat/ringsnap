import { CallOutcomeEvent } from "../types/integrations";

export interface CrmAdapter {
    syncCallOutcome(event: CallOutcomeEvent): Promise<void>;
}
