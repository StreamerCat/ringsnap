export const POOL_CONFIG = {
    // Feature Flag
    // Feature Flag
    ENABLED: Deno.env.get("NUMBER_POOL_ENABLED") !== "false", // Defaults to true, disable with "false"

    // Cooldown Settings
    MIN_COOLDOWN_DAYS: Number(Deno.env.get("NUMBER_POOL_MIN_COOLDOWN_DAYS")) || 28,
    MIN_SILENCE_DAYS: Number(Deno.env.get("NUMBER_POOL_MIN_SILENCE_DAYS")) || 10,

    // Inventory Management
    INVENTORY_TARGET: Number(Deno.env.get("NUMBER_POOL_INVENTORY_TARGET")) || 50,
    INVENTORY_MAX: Number(Deno.env.get("NUMBER_POOL_INVENTORY_MAX")) || 100,

    // Eligibility
    ELIGIBLE_REASONS: ["canceled", "delinquent", "failed_provision", "fraud"],
    ONLY_CANCELED: Deno.env.get("NUMBER_POOL_ONLY_CANCELED") === "true",
    GRACE_DAYS: Number(Deno.env.get("NUMBER_POOL_GRACE_DAYS")) || 3,
};

export const LIFECYCLE_STATUS = {
    ASSIGNED: 'assigned',
    COOLDOWN: 'cooldown',
    POOL: 'pool',
    QUARANTINE: 'quarantine',
    RELEASED: 'released',
} as const;
