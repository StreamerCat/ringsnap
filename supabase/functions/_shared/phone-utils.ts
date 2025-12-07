
import { parsePhoneNumber, CountryCode } from "https://esm.sh/libphonenumber-js@1.10.44";

export interface AreaCodePreference {
    areaCode: string;
    source: 'onboarding_phone' | 'billing_zip' | 'default';
}

const DEFAULT_US_AREA_CODE = Deno.env.get("DEFAULT_US_AREA_CODE") || "303";

// Simple mapping for initial MVP - can be expanded later
// This could be moved to a database table or larger JSON config if it grows
const ZIP_TO_AREA_CODE_MAP: Record<string, string> = {
    // CO
    "80": "303", "81": "970",
    // CA
    "90": "310", "91": "818", "92": "619", "93": "559", "94": "415", "95": "408",
    // NY
    "10": "212", "11": "718",
    // TX
    "75": "214", "76": "817", "77": "713", "78": "512",
    // FL
    "32": "407", "33": "305",
};

/**
 * Determines the best area code for a user based on their onboarding phone or billing zip.
 */
export function getPreferredAreaCode(
    onboardingPhone?: string,
    billingZip?: string
): AreaCodePreference {

    // 1. Try onboarding phone
    if (onboardingPhone) {
        try {
            // Normalize and parse
            // We assume US context if not provided, but libphonenumber handles international format
            const phoneNumber = parsePhoneNumber(onboardingPhone, 'US');

            if (phoneNumber.isValid() && phoneNumber.country === 'US') {
                // Create a fake number to extract area code if needed, but the library might expose nationalNumber
                // The national number for US starts with Area Code. 
                // Or simpler: formatted E.164 is +1AAABBBCCCC. Area code is AAA.
                const national = phoneNumber.formatNational(); // (AAA) BBB-CCCC or similar
                // Extract 3 digits
                const match = national.match(/\((\d{3})\)/) || national.match(/^(\d{3})/);

                if (match && match[1]) {
                    return { areaCode: match[1], source: 'onboarding_phone' };
                }
            }
        } catch (e) {
            // Ignore parsing errors and fall through
            console.warn(`Failed to parse onboarding phone: ${onboardingPhone}`, e);
        }
    }

    // 2. Try Billing Zip
    if (billingZip && billingZip.length >= 2) {
        // Look at first 2 digits for a rough region match
        const prefix = billingZip.slice(0, 2);
        if (ZIP_TO_AREA_CODE_MAP[prefix]) {
            return { areaCode: ZIP_TO_AREA_CODE_MAP[prefix], source: 'billing_zip' };
        }
    }

    // 3. Fallback
    return { areaCode: DEFAULT_US_AREA_CODE, source: 'default' };
}
