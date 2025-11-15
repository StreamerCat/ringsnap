/**
 * Device Nonce Utility
 * Creates a unique identifier for this device/browser to bind magic links
 *
 * This prevents magic links from being used on different devices than where
 * they were requested, adding an extra layer of security.
 */

const STORAGE_KEY = 'device_nonce';

/**
 * Get existing device nonce from localStorage or create a new one
 *
 * @returns Device nonce string (UUID format)
 */
export function getOrCreateDeviceNonce(): string {
  // Check if we're in a browser environment with localStorage
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    // Server-side or no localStorage: generate ephemeral nonce
    return crypto.randomUUID();
  }

  let nonce = localStorage.getItem(STORAGE_KEY);

  if (!nonce) {
    // Create new nonce using Web Crypto API
    nonce = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, nonce);
  }

  return nonce;
}

/**
 * Clear device nonce (useful for testing or logout)
 *
 * This will force a new device nonce to be generated on next use
 */
export function clearDeviceNonce(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Check if a device nonce exists
 *
 * @returns true if device nonce is stored, false otherwise
 */
export function hasDeviceNonce(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(STORAGE_KEY) !== null;
}
