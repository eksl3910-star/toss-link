// Session cookie name — different from reference session name
export const SESSION_COOKIE = "als_token";

// Session validity: 14 days (로그인 유지 체크 시)
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// 로그인 유지 미체크: 브라우저 닫으면 쿠키 삭제 + 서버 세션도 짧게
export const SESSION_TTL_SHORT_MS = 24 * 60 * 60 * 1000;

// Claim window for a received link: 5 seconds
export const CLAIM_WINDOW_MS = 5_000;

// Only URLs ending with this hostname are accepted
export const TOSS_LINK_HOSTNAME = "toss.im";

// PBKDF2 iteration count
export const PBKDF2_ITERATIONS = 100_000;

// Admin password env key (checked in order)
export const ADMIN_PASS_ENVS = ["ADMIN_TOGGLE_PASS", "ADMIN_BASIC_PASS"] as const;

/** Basic 통과 후 RSC 요청 등에 쓰는 관리자 게이트 쿠키 (httpOnly) */
export const ADMIN_GATE_COOKIE = "als_admin_gate";
