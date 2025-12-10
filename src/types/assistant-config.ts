
export type AssistantPlanTier = "trial" | "starter" | "pro" | "premium"

export interface AssistantConfigMeta {
    version: number
    lastUpdatedAt: string          // ISO timestamp
    lastUpdatedByUserId: string | null
}

export interface AssistantBusinessConfig {
    name: string
    services: string[]             // e.g. ["plumbing", "hvac"]
    serviceAreaDescription: string // e.g. "Fort Collins and nearby towns"
}

export type AssistantToneStyle =
    | "friendly"
    | "warm_professional"
    | "calm"
    | "high_energy"

export interface AssistantToneConfig {
    style: AssistantToneStyle
    humorAllowed: boolean
    speakSpeed: "normal" | "slower" | "faster"
}

export type IntakeField =
    | "name"
    | "phone"
    | "email"
    | "address"
    | "problem"
    | "preferredTime"
    | "budget"

export interface AssistantIntakeConfig {
    requiredFields: IntakeField[]
    optionalFields: IntakeField[]
    disallowedJobsDescription?: string // things we do not want to book
}

export type SchedulingMode = "calendar_link" | "callback"

export interface AssistantSchedulingConfig {
    mode: SchedulingMode
    calendarUrl?: string            // booking or calendar link
    typicalBookingWindow:
    | "same_day"
    | "two_to_three_days"
    | "within_week"
    | "flexible"
    callbackInstructions?: string   // what to tell the caller if doing callbacks
}

export type EmergencyHandlingMode =
    | "always_direct_to_911"
    | "try_emergency_contact_then_911"
    | "info_only_not_emergency_provider"

export interface AssistantEmergencyConfig {
    handlingMode: EmergencyHandlingMode
    emergencyContactNumber?: string // if using try_emergency_contact_then_911
    scriptSummary: string           // short description of how to respond in emergencies
}

export interface AssistantBoundariesConfig {
    avoidTopics: string[]           // e.g. ["legal advice", "exact pricing guarantees"]
    pricingGuidelines: string       // e.g. "give ranges only, no guaranteed quotes"
    legalDisclaimer?: string
}

export interface AssistantMessagingConfig {
    afterHoursBehavior: string      // what to say after business hours
    holdMusicDescription?: string
    voicemailBehavior?: string
}

export interface AssistantIntegrationsConfig {
    useCalendarUrlFromAccount: boolean
    calendarUrlOverride?: string
}

export interface AssistantAdvancedConfig {
    // Reserved for Pro / Premium UI and power users.
    customPhrases?: string[]        // short phrases the owner wants used
    bannedPhrases?: string[]        // phrases the owner wants avoided
}

export interface AssistantConfig {
    meta: AssistantConfigMeta

    business: AssistantBusinessConfig
    tone: AssistantToneConfig
    intake: AssistantIntakeConfig
    scheduling: AssistantSchedulingConfig
    emergencies: AssistantEmergencyConfig
    boundaries: AssistantBoundariesConfig
    messaging: AssistantMessagingConfig
    integrations: AssistantIntegrationsConfig

    // Only editable in UI when plan tier is "pro" or "premium"
    advanced?: AssistantAdvancedConfig
}

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
    meta: {
        version: 1,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedByUserId: null
    },
    business: {
        name: "My Business",
        services: [],
        serviceAreaDescription: ""
    },
    tone: {
        style: "warm_professional",
        humorAllowed: false,
        speakSpeed: "normal"
    },
    intake: {
        requiredFields: ["name", "phone", "problem"],
        optionalFields: ["address"],
        disallowedJobsDescription: ""
    },
    scheduling: {
        mode: "callback",
        typicalBookingWindow: "flexible"
    },
    emergencies: {
        handlingMode: "info_only_not_emergency_provider",
        scriptSummary: "Politely inform the caller to dial 911 for true emergencies."
    },
    boundaries: {
        avoidTopics: [],
        pricingGuidelines: "Do not provide specific quotes."
    },
    messaging: {
        afterHoursBehavior: "Take a message and promise a callback.",
    },
    integrations: {
        useCalendarUrlFromAccount: true
    }
};
