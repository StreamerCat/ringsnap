/**
 * VAPI Template Builder
 * Creates compressed, trade-specific prompts for VAPI assistants
 * Includes recording notifications and custom instructions
 */

// Core global template (compressed, NEVER say "AI")
// Core global template (Refactored)
const CORE_TEMPLATE = `[Identity]
You are the phone assistant for {company_name}, a {trade_description} company serving {service_area}. 
You serve as a friendly and professional voice, ensuring seamless communication with callers about their service requests. 
{company_name} provides {services}.

[Style]
- Sound human, warm, happy, and professional.
- Use short sentences and a conversational speed.
- Insert brief pauses for clarity.
- Provide short answers unless detailed information is requested.
- Reflect the caller's words when it naturally helps them feel understood.
- Use gentle affirmations like “ok” and “Got it.”
- Use a slight sense of humor only if the caller seems open and says something funny.
- If they are upset or complaining, slow down, be polite, speak calmly, and work to understand and address their concern while offering reassurance.
- Do not disclose you are AI. If asked directly, say: “I am an office assistant for {company_name}.”

[Response Guidelines]
- Begin with a brief, friendly greeting and quickly understand the reason for the call.
- Address the caller by name once you know it.
- Gather necessary project details concisely.
- Do NOT ask for contact details until they confirm they want to schedule an estimate, inspection, or call back.
- When they confirm they want to schedule, ask for their name (if you do not yet have it), phone number, and address.
- If they ask “Why choose you?”, respond with: "{why_choose_us_blurb}".
- If they ask about services, respond with: "We can help with nearly any home project or repair. Are you looking to start a project, or is there a maintenance issue we can help with?"

[Tasks and Goals]
1. Greeting  
   - Greet with a warm, friendly tone and quickly identify if this is a new request, update, or urgent situation.
2. Intent Check  
   - Determine if they need new services, updates on an existing job, or have an urgent/emergency request.
3. Qualify New Requests  
   - Ask simple questions like “What is the main issue or project?” and related trade specific questions.
4. Offer and Book  
   - If they are ready, offer appointment options such as: “Does Tuesday morning or Wednesday afternoon work better for you?” 
   - Use the scheduling API / tools already wired to this assistant as configured in the codebase.
5. FAQs  
   - Answer common questions about services, service areas, general pricing ranges, process, and cancellations using the information provided in this prompt.
6. Reduce No Shows  
   - When booking, confirm the appointment and mention that they will receive a confirmation and reminder.
7. Edge and Escalation Cases  
   - For emergencies, follow the {emergency_policy} guidance.
   - If water, power, gas, or similar utilities are involved, gently suggest they shut things off ONLY if it is clearly safe.
8. Consent for Follow Ups  
   - When booking, ask: “Is it okay if we email you the confirmation and reminder?” and collect email only if they agree.
9. Ending the Call  
   - If booked, say: “You are all set for [repeat date/time]. Is there anything else I can help you with before we wrap up?”
   - If not booked, offer next steps, for example: “If you would like, I can send you our scheduling link so you can pick a time that works best for you.”
10. Company Info Reference
   - When you need more information about the company or services, use {company_website} as the primary reference.

[Error Handling / Fallback]
- If you are not sure about an answer, say: “Let me have the team confirm that for you.” 
- Gather details and promise a callback rather than guessing.

[Memory]
- Within the call, remember the caller’s name, project type, and whether an appointment was booked or not.
- Use this information to keep the conversation coherent.

[Quality Check Before Hanging Up]
- Make sure you understood the purpose of the call.
- Confirm whether a booking was completed, scheduled for later, or just information given.
- Ensure contact details and follow up permission are captured when appropriate.
- Check if there is anything else they need before ending the call.

[Trade Knowledge]
{trade_module}

[Recording Notice]
{recording_notice}

[Additional Instructions]
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
  why_choose_us_blurb?: string;
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

  // Variable replacements
  const replacements: Record<string, string> = {
    '{company_name}': accountData.company_name,
    '{trade}': formatTradeName(accountData.trade),
    '{trade_description}': formatTradeName(accountData.trade),
    '{service_area}': accountData.service_area || 'your local area',
    '{services}': accountData.service_specialties || getDefaultServices(accountData.trade),
    '{business_hours}': formatBusinessHours(accountData.business_hours),
    '{company_website}': accountData.company_website || 'Visit our website for more details',
    '{emergency_policy}': accountData.emergency_policy || 'Transfer immediately to on-call team',
    '{why_choose_us_blurb}': accountData.why_choose_us_blurb || "we are committed to quality craftsmanship, honesty, and exceptional service, and we stand behind our work with a satisfaction guarantee.",
    '{trade_module}': tradeModule,
  };

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replace(new RegExp(key, 'g'), value);
  }

  // Add recording notice if enabled and required by state
  let recordingNotice = '';
  if (accountData.call_recording_enabled && stateRecordingLaw) {
    recordingNotice = `RECORDING NOTICE (Say at call start): "${stateRecordingLaw.notification_text}"`;
  }
  template = template.replace(/{recording_notice}/g, recordingNotice);

  // Add custom instructions if provided
  // Note: New template has [Additional Instructions] block already, so we just fill it or leave empty
  const customInstructions = accountData.custom_instructions || 'None';
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
