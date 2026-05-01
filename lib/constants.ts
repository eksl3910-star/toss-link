// Session cookie name — different from reference "ably_session"
export const SESSION_COOKIE = "als_token";

// Session validity: 14 days in milliseconds
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// Claim window for a received link: 5 seconds
export const CLAIM_WINDOW_MS = 5_000;

// Only URLs ending with this hostname are accepted
export const ABLY_HOSTNAME = "a-bly.com";

// PBKDF2 iteration count
export const PBKDF2_ITERATIONS = 100_000;

// Admin password env key (checked in order)
export const ADMIN_PASS_ENVS = ["ADMIN_TOGGLE_PASS", "ADMIN_BASIC_PASS"] as const;
