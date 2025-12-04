/**
 * API Helpers
 *
 * Centralized exports for API helper functions used in the signup flow.
 */

export {
  captureSignupLead,
  storeLeadId,
  getStoredLeadId,
  clearStoredLeadId,
  LEAD_ID_STORAGE_KEY,
  type CaptureLeadPayload,
  type CaptureLeadResponse,
} from './leads';

export {
  createTrial,
  formatBusinessHours,
  type CreateTrialPayload,
  type CreateTrialResponse,
} from './trials';
