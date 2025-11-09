/**
 * VAPI Template Builder
 * Creates compressed, trade-specific prompts for VAPI assistants
 * Includes recording notifications and custom instructions
 */

// Core global template (compressed, NEVER say "AI")
const CORE_TEMPLATE = `You are the professional receptionist for {company_name}, a trusted {trade} company serving {service_area}.

NEVER say you're AI. You ARE {company_name}.

Key Info:
- Services: {services}
- Hours: {business_hours}
- Website: {company_website}
- Emergency: {emergency_policy}
{recording_notice}

Tasks:
1. Answer professionally, warm tone
2. Qualify: name, issue, urgency, location
3. Check availability, book appointments
4. Get phone/email for follow-up
5. Emergency → immediate transfer
6. Quote requests → gather details, promise callback

Always helpful, never pushy. If unsure, say "Let me have our team call you back."
{custom_instructions}`;

// Trade-specific modules (compressed)
const TRADE_MODULES: Record<string, string> = {
  'plumbing': `
Common Issues: leaks, clogs, water heaters, pipe repairs
Questions: water shut-off? standing water? fixture age?
Emergency signs: flooding, no water, gas smell
Typical jobs: 1-2 hrs, $150-400`,

  'hvac': `
Common Issues: no heat/cool, strange noises, high bills
Questions: thermostat setting? filter age? system age?
Emergency signs: no heat <40°F, no AC >90°F
Typical jobs: 1-3 hrs, $100-500`,

  'electrical': `
Common Issues: outlets, breakers, lights, wiring
Questions: total outage? specific circuits? burning smell?
Emergency signs: sparks, burning smell, no power
Safety: NEVER touch if sparking/smoking
Typical jobs: 1-2 hrs, $150-350`,

  'roofing': `
Common Issues: leaks, shingles, gutters, inspection
Questions: active leak? storm damage? roof age?
Emergency signs: active interior leak, fallen tree
Typical jobs: 4-8 hrs, $300-2000`,

  'landscaping': `
Common Services: mowing, trimming, design, maintenance
Questions: property size? current condition? budget?
Seasonal: spring/fall cleanups, winter prep
Typical jobs: 2-4 hrs, $100-500`,

  'painting': `
Common Services: interior, exterior, cabinet refinish
Questions: square footage? color chosen? walls condition?
Prep important: repair, prime, caulk
Typical jobs: 1-3 days, $500-3000`,

  'general_contractor': `
Common Projects: remodels, additions, repairs, permits
Questions: project scope? timeline? budget range?
Process: quote → permit → schedule → complete
Typical jobs: 1-4 weeks, $2000-50000`,

  'handyman': `
Common Services: repairs, install, assembly, patches
Questions: list of tasks? priority? access timing?
Efficiency: bundle multiple tasks
Typical jobs: 2-4 hrs, $100-400`,

  'locksmith': `
Common Services: lockout, rekey, install, repair
Questions: residential/commercial? locked out now? key type?
Emergency: lockouts 24/7, 30-60 min arrival
Typical jobs: 30-90 min, $75-250`,

  'pest_control': `
Common Issues: rodents, insects, termites, wildlife
Questions: what pest? seen when? infestation size?
Process: inspection → treatment → follow-up
Typical jobs: 1-2 hrs, $150-500`,
};

export interface AccountData {
  company_name: string;
  trade: string;
  service_area: string;
  business_hours?: string;
  emergency_policy?: string;
  service_specialties?: string;
  company_website?: string;
  custom_instructions?: string;
  billing_state?: string;
  call_recording_enabled?: boolean;
}

export interface StateRecordingLaw {
  consent_type: string;
  notification_text: string;
}

/**
 * Build compressed VAPI prompt from account data
 */
export async function buildVapiPrompt(
  accountData: AccountData,
  stateRecordingLaw?: StateRecordingLaw | null
): Promise<string> {
  let template = CORE_TEMPLATE;

  // Get trade-specific module
  const tradeModule = TRADE_MODULES[accountData.trade] || TRADE_MODULES['general_contractor'];
  
  // Inject trade module
  template += tradeModule;

  // Replace variables
  template = template
    .replace(/{company_name}/g, accountData.company_name)
    .replace(/{trade}/g, formatTradeName(accountData.trade))
    .replace(/{service_area}/g, accountData.service_area || 'your local area')
    .replace(/{services}/g, accountData.service_specialties || getDefaultServices(accountData.trade))
    .replace(/{business_hours}/g, formatBusinessHours(accountData.business_hours))
    .replace(/{company_website}/g, accountData.company_website || 'Visit our website for more details')
    .replace(/{emergency_policy}/g, accountData.emergency_policy || 'Transfer immediately to on-call team');

  // Add recording notice if enabled and required by state
  let recordingNotice = '';
  if (accountData.call_recording_enabled && stateRecordingLaw) {
    recordingNotice = `\nRECORDING NOTICE (Say at call start): "${stateRecordingLaw.notification_text}"`;
  }
  template = template.replace(/{recording_notice}/g, recordingNotice);

  // Add custom instructions if provided
  let customInstructions = '';
  if (accountData.custom_instructions) {
    customInstructions = `\n\nADDITIONAL INSTRUCTIONS:\n${accountData.custom_instructions}`;
  }
  template = template.replace(/{custom_instructions}/g, customInstructions);

  // Compress whitespace
  template = template.replace(/\n{3,}/g, '\n\n').trim();

  return template;
}

/**
 * Format trade name for display
 */
function formatTradeName(trade: string): string {
  const tradeNames: Record<string, string> = {
    'plumbing': 'plumbing',
    'hvac': 'heating and cooling',
    'electrical': 'electrical',
    'roofing': 'roofing',
    'landscaping': 'landscaping',
    'painting': 'painting',
    'general_contractor': 'general contracting',
    'handyman': 'handyman',
    'locksmith': 'locksmith',
    'pest_control': 'pest control',
  };
  return tradeNames[trade] || 'home services';
}

/**
 * Get default services for trade
 */
function getDefaultServices(trade: string): string {
  const defaultServices: Record<string, string> = {
    'plumbing': 'drain cleaning, leak repair, water heater service, pipe replacement',
    'hvac': 'AC repair, heating service, maintenance, installation',
    'electrical': 'outlet repair, panel upgrades, lighting, wiring',
    'roofing': 'leak repair, shingle replacement, inspection, gutter service',
    'landscaping': 'lawn maintenance, trimming, design, seasonal cleanup',
    'painting': 'interior painting, exterior painting, cabinet refinishing',
    'general_contractor': 'remodeling, additions, repairs, renovations',
    'handyman': 'repairs, installations, assembly, maintenance',
    'locksmith': 'lockout service, rekeying, lock installation, repair',
    'pest_control': 'rodent removal, insect treatment, termite inspection',
  };
  return defaultServices[trade] || 'professional home services';
}

/**
 * Format business hours for prompt
 */
function formatBusinessHours(hours?: string): string {
  if (!hours) {
    return 'Mon-Fri 8am-5pm, Sat 9am-2pm';
  }
  
  // If it's already formatted, return as-is
  if (typeof hours === 'string') {
    return hours;
  }
  
  // If it's JSON, parse and format
  try {
    const parsed = typeof hours === 'string' ? JSON.parse(hours) : hours;
    // Format from structured data if available
    return hours;
  } catch {
    return hours;
  }
}
