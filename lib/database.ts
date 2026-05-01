import { getRequestContext } from "@cloudflare/next-on-pages";
import { SESSION_TTL_MS, CLAIM_WINDOW_MS, ABLY_HOSTNAME } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  nickname: string;
  joinedAt: number;
};

export type SessionRow = {
  id: string;
  userId: string;
  validUntil: number;
};

export type LinkState = "queued" | "claimed" | "consumed";

export type LinkRow = {
  id: string;
  url: string;
  ownerId: string;
  state: LinkState;
  queuePos: number;
  createdAt: number;
  updatedAt: number;
  takerId: string | null;
  claimDeadline: number | null;
  claimedAt: number | null;
  consumedAt: number | null;
};

export type AdminMetrics = {
  totalUsers: number;
  newUsersToday: number;
  totalLinks: number;
  queuedLinks: number;
  consumedLinks: number;
};

// ── DB access ─────────────────────────────────────────────────────────────────

type D1Env = { DB?: D1Database };

/** D1Database는 보통 prepare + exec 를 가짐 (다른 CF 바인딩과 구분) */
function isD1Database(v: unknown): v is D1Database {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { prepare?: unknown; exec?: unknown };
  return typeof o.prepare === "function" && typeof o.exec === "function";
}

/** 허용된 바인딩 이름만 조회 (임의 auto-scan 금지) */
function pickD1FromEnv(env: unknown): D1Database | undefined {
  if (!env || typeof env !== "object") return undefined;
  const record = env as Record<string, unknown>;
  const candidates = ["DB", "D1_DB", "DATABASE", "D1"];
  for (const key of candidates) {
    const value = record[key];
    if (isD1Database(value)) return value;
  }
  return undefined;
}

export function getDb(): D1Database {
  let env: unknown;
  try {
    env = getRequestContext().env;
  } catch {
    env = undefined;
  }

  let db = pickD1FromEnv(env);
  if (!db) {
    const g = globalThis as unknown as { DB?: unknown };
    if (isD1Database(g.DB)) db = g.DB;
  }

  if (!db) {
    throw new Error(
      "D1 binding을 찾지 못했거나 잘못된 바인딩을 참조했습니다. Cloudflare 대시보드에서 D1 binding 이름을 `DB`로 설정하고(Functions → D1 database bindings), ably-link-db를 연결한 뒤 재배포하세요."
    );
  }
  return db;
}

/** 기존 DB는 `email`, 신규 스키마는 `nickname` — 둘 다 지원 */
type UsersLoginCol = "nickname" | "email";
let cachedUsersLoginCol: UsersLoginCol | undefined;

export async function getUsersLoginColumn(db: D1Database): Promise<UsersLoginCol> {
  if (cachedUsersLoginCol) return cachedUsersLoginCol;
  const res = await db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const names = new Set((res.results ?? []).map((r) => r.name));
  if (names.has("nickname")) cachedUsersLoginCol = "nickname";
  else if (names.has("email")) cachedUsersLoginCol = "email";
  else {
    throw new Error("users 테이블에 nickname 또는 email 컬럼이 없습니다. 마이그레이션을 확인하세요.");
  }
  return cachedUsersLoginCol;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 영문 대문자만 소문자로 통일 (한글·숫자는 그대로). */
export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** 특수문자 제외: 영어, 한글(음절·자모), 숫자만 허용. */
const NICKNAME_CHARS = /^[a-z0-9\uAC00-\uD7A3\u3131-\u318E]+$/;

export function validateNicknameRules(normalized: string): string | null {
  if (normalized.length < 2) return "닉네임은 2자 이상이어야 합니다.";
  if (normalized.length > 20) return "닉네임은 20자 이하여야 합니다.";
  if (!NICKNAME_CHARS.test(normalized)) {
    return "닉네임은 영어, 한글, 숫자만 사용할 수 있습니다.";
  }
  return null;
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function insertUser(
  nickname: string,
  pwHash: string,
  pwSalt: string
): Promise<User> {
  const db = getDb();
  const col = await getUsersLoginColumn(db);
  const now = Date.now();
  const id = crypto.randomUUID();
  const normalized = normalizeNickname(nickname);

  await db
    .prepare(
      `INSERT INTO users (id, ${col}, pw_hash, pw_salt, joined_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, normalized, pwHash, pwSalt, now)
    .run();

  return { id, nickname: normalized, joinedAt: now };
}

export async function findUserByNickname(nickname: string): Promise<
  | (User & { pwHash: string; pwSalt: string })
  | null
> {
  const db = getDb();
  const col = await getUsersLoginColumn(db);
  const normalized = normalizeNickname(nickname);
  if (!normalized) return null;
  return db
    .prepare(
      `SELECT id, ${col} AS nickname, pw_hash AS pwHash, pw_salt AS pwSalt, joined_at AS joinedAt
       FROM users WHERE ${col} = ?`
    )
    .bind(normalized)
    .first<User & { pwHash: string; pwSalt: string }>();
}

export async function findUserById(userId: string): Promise<User | null> {
  const db = getDb();
  if (!userId) return null;
  const col = await getUsersLoginColumn(db);
  return db
    .prepare(`SELECT id, ${col} AS nickname, joined_at AS joinedAt FROM users WHERE id = ?`)
    .bind(userId)
    .first<User>();
}

export async function removeUserAndData(userId: string): Promise<void> {
  const db = getDb();
  await db.prepare(`DELETE FROM sessions  WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM receipts  WHERE taker_id = ?`).bind(userId).run();
  await db
    .prepare(`DELETE FROM receipts WHERE link_id IN (SELECT id FROM links WHERE owner_id = ?)`)
    .bind(userId)
    .run();
  await db.prepare(`DELETE FROM links     WHERE owner_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM users     WHERE id = ?`).bind(userId).run();
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function createSession(
  userId: string
): Promise<{ id: string; validUntil: number }> {
  const db = getDb();
  const now = Date.now();
  const id = crypto.randomUUID();
  const validUntil = now + SESSION_TTL_MS;

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, valid_until, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, userId, validUntil, now)
    .run();

  return { id, validUntil };
}

export async function lookupSession(
  sessionId: string
): Promise<SessionRow | null> {
  const db = getDb();
  const now = Date.now();
  if (!sessionId) return null;

  const row = await db
    .prepare(
      `SELECT id, user_id AS userId, valid_until AS validUntil
       FROM sessions WHERE id = ?`
    )
    .bind(sessionId)
    .first<SessionRow>();

  if (!row) return null;

  if (row.validUntil <= now) {
    await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
    return null;
  }

  return row;
}

export async function destroySession(sessionId: string): Promise<void> {
  const db = getDb();
  if (!sessionId) return;
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}

// ── Settings / Maintenance ────────────────────────────────────────────────────

export async function getSettings(): Promise<{
  maintenanceOn: boolean;
  touchedAt: number;
}> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT maintenance_on AS maintenanceOn, touched_at AS touchedAt
       FROM settings WHERE key = 'global'`
    )
    .first<{ maintenanceOn: number; touchedAt: number }>();

  return {
    maintenanceOn: Boolean(row?.maintenanceOn ?? 0),
    touchedAt: row?.touchedAt ?? 0,
  };
}

export async function setMaintenance(
  on: boolean
): Promise<{ maintenanceOn: boolean; touchedAt: number }> {
  const db = getDb();
  const now = Date.now();
  await db
    .prepare(
      `UPDATE settings SET maintenance_on = ?, touched_at = ? WHERE key = 'global'`
    )
    .bind(on ? 1 : 0, now)
    .run();
  return { maintenanceOn: on, touchedAt: now };
}

// ── Link helpers ──────────────────────────────────────────────────────────────

export function parseAblyUrl(raw: string): string | null {
  const text = raw.trim();
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (!url.hostname.toLowerCase().endsWith(ABLY_HOSTNAME)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function purgeExpiredClaims(db: D1Database, nowMs: number): Promise<void> {
  await db
    .prepare(
      `UPDATE links
       SET state = 'queued', taker_id = NULL,
           claim_deadline = NULL, claimed_at = NULL, updated_at = ?
       WHERE state = 'claimed'
         AND claim_deadline IS NOT NULL
         AND claim_deadline < ?`
    )
    .bind(nowMs, nowMs)
    .run();
}

export async function isDuplicateLink(
  ownerId: string,
  url: string
): Promise<boolean> {
  const db = getDb();
  const existing = await db
    .prepare(
      `SELECT id FROM links
       WHERE url = ? AND owner_id = ? AND state IN ('queued', 'claimed')`
    )
    .bind(url, ownerId)
    .first<{ id: string }>();
  return existing !== null;
}

export async function enqueueLink(ownerId: string, url: string): Promise<{ id: string }> {
  const db = getDb();
  const now = Date.now();
  const id = crypto.randomUUID();
  await purgeExpiredClaims(db, now);
  await db
    .prepare(
      `INSERT INTO links (id, url, owner_id, state, queue_pos, created_at, updated_at)
       VALUES (?, ?, ?, 'queued', ?, ?, ?)`
    )
    .bind(id, url, ownerId, now, now, now)
    .run();
  return { id };
}

export async function prioritizeLink(
  ownerId: string
): Promise<{ ok: true; id: string } | { ok: false; reason: "NO_QUEUED_LINK" }> {
  const db = getDb();
  const now = Date.now();

  const row = await db
    .prepare(
      `SELECT id FROM links
       WHERE owner_id = ? AND state = 'queued'
       ORDER BY queue_pos DESC
       LIMIT 1`
    )
    .bind(ownerId)
    .first<{ id: string }>();

  if (!row) return { ok: false, reason: "NO_QUEUED_LINK" };

  await db
    .prepare(
      `UPDATE links SET queue_pos = 0, updated_at = ?
       WHERE id = ? AND owner_id = ? AND state = 'queued'`
    )
    .bind(now, row.id, ownerId)
    .run();

  return { ok: true, id: row.id };
}

export async function getLinkCounts(
  userId: string
): Promise<{ total: number; mine: number }> {
  const db = getDb();
  const now = Date.now();
  await purgeExpiredClaims(db, now);

  const total = await db
    .prepare(`SELECT COUNT(*) AS c FROM links WHERE state = 'queued'`)
    .first<{ c: number }>();

  const mine = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM links WHERE state = 'queued' AND owner_id = ?`
    )
    .bind(userId)
    .first<{ c: number }>();

  return { total: total?.c ?? 0, mine: mine?.c ?? 0 };
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const db = getDb();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = now - (now % dayMs);

  const totalUsers = await db
    .prepare(`SELECT COUNT(*) AS c FROM users`)
    .first<{ c: number }>();

  const newUsersToday = await db
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE joined_at >= ?`)
    .bind(startOfDay)
    .first<{ c: number }>();

  const totalLinks = await db
    .prepare(`SELECT COUNT(*) AS c FROM links`)
    .first<{ c: number }>();

  const queuedLinks = await db
    .prepare(`SELECT COUNT(*) AS c FROM links WHERE state = 'queued'`)
    .first<{ c: number }>();

  const consumedLinks = await db
    .prepare(`SELECT COUNT(*) AS c FROM links WHERE state = 'consumed'`)
    .first<{ c: number }>();

  return {
    totalUsers: totalUsers?.c ?? 0,
    newUsersToday: newUsersToday?.c ?? 0,
    totalLinks: totalLinks?.c ?? 0,
    queuedLinks: queuedLinks?.c ?? 0,
    consumedLinks: consumedLinks?.c ?? 0,
  };
}

// ── Link claim / consume / return ─────────────────────────────────────────────

export async function acquireLink(takerId: string): Promise<
  | { ok: true; link: { id: string; url: string; deadline: number } }
  | { ok: false; reason: "NO_LINK" | "RACE" }
> {
  const db = getDb();
  const now = Date.now();
  const deadline = now + CLAIM_WINDOW_MS;

  await purgeExpiredClaims(db, now);
  await db.exec("BEGIN");

  try {
    const candidate = await db
      .prepare(
        `SELECT l.id, l.url
         FROM links l
         WHERE l.state = 'queued'
           AND l.owner_id != ?
           AND NOT EXISTS (
             SELECT 1 FROM receipts r
             WHERE r.link_id = l.id AND r.taker_id = ?
           )
         ORDER BY l.queue_pos ASC
         LIMIT 1`
      )
      .bind(takerId, takerId)
      .first<{ id: string; url: string }>();

    if (!candidate) {
      await db.exec("COMMIT");
      return { ok: false, reason: "NO_LINK" };
    }

    const result = await db
      .prepare(
        `UPDATE links
         SET state = 'claimed', taker_id = ?, claim_deadline = ?, claimed_at = ?, updated_at = ?
         WHERE id = ? AND state = 'queued'`
      )
      .bind(takerId, deadline, now, now, candidate.id)
      .run();

    if (result.meta.changes !== 1) {
      await db.exec("ROLLBACK");
      return { ok: false, reason: "RACE" };
    }

    await db
      .prepare(
        `INSERT OR IGNORE INTO receipts (link_id, taker_id, created_at) VALUES (?, ?, ?)`
      )
      .bind(candidate.id, takerId, now)
      .run();

    await db.exec("COMMIT");
    return { ok: true, link: { id: candidate.id, url: candidate.url, deadline } };
  } catch (err) {
    await db.exec("ROLLBACK");
    throw err;
  }
}

export async function confirmLink(
  takerId: string,
  linkId: string
): Promise<{ ok: true; url: string } | { ok: false; reason: "NOT_CLAIMED" | "EXPIRED" }> {
  const db = getDb();
  const now = Date.now();
  await purgeExpiredClaims(db, now);

  const row = await db
    .prepare(
      `SELECT id, url, taker_id AS takerId, claim_deadline AS claimDeadline, state
       FROM links WHERE id = ?`
    )
    .bind(linkId)
    .first<{
      id: string;
      url: string;
      takerId: string | null;
      claimDeadline: number | null;
      state: string;
    }>();

  if (!row || row.state !== "claimed" || row.takerId !== takerId) {
    return { ok: false, reason: "NOT_CLAIMED" };
  }
  if (!row.claimDeadline || row.claimDeadline < now) {
    return { ok: false, reason: "EXPIRED" };
  }

  await db
    .prepare(
      `UPDATE links SET state = 'consumed', consumed_at = ?, updated_at = ?
       WHERE id = ? AND state = 'claimed' AND taker_id = ?`
    )
    .bind(now, now, linkId, takerId)
    .run();

  return { ok: true, url: row.url };
}

export async function releaseLink(
  takerId: string,
  linkId: string
): Promise<{ ok: boolean }> {
  const db = getDb();
  const now = Date.now();

  const res = await db
    .prepare(
      `UPDATE links
       SET state = 'queued', taker_id = NULL, claim_deadline = NULL, claimed_at = NULL, updated_at = ?
       WHERE id = ? AND state = 'claimed' AND taker_id = ?`
    )
    .bind(now, linkId, takerId)
    .run();

  return { ok: res.meta.changes === 1 };
}
