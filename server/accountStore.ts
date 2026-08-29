/**
 * ARICIMAP hesap ve konum deposu — PostgreSQL sürümü.
 *
 * Ücretsiz barındırma planlarında sunucunun diski kalıcı değildir; her yeniden
 * başlatmada dosyalar silinir. Bu yüzden hesaplar ve konumlar harici bir
 * veritabanında tutulur.
 *
 * Parolalar scrypt ile, kullanıcıya özel tuz kullanılarak saklanır; düz metin
 * parola hiçbir zaman veritabanına yazılmaz.
 */
import crypto from "node:crypto";
import pg from "pg";

export type UserStatus = "beklemede" | "onayli" | "reddedildi";
export type UserRole = "arici" | "personel" | "yonetici";

export interface StoredUser {
  id: string;
  name: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  status: UserStatus;
  staffCode: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface StoredLocation {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  hives: number | null;
  place: string;
  note: string;
  source: string;
  updatedAt: string;
}

const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL tanımlı değil. Neon bağlantı dizesini ortam değişkeni olarak verin.");
}

/**
 * Neon bağlantıları TLS ister ve sertifikası genel bir CA tarafından imzalıdır,
 * bu yüzden doğrulama kapatılmaz. Yerel testte TLS aranmaz.
 */
const isLocal = /localhost|127\.0\.0\.1|@\/|host=\/|\/tmp/.test(connectionString);
export const pool = new pg.Pool({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: true },
  max: 5,
  idleTimeoutMillis: 30000,
});

let ready: Promise<void> | null = null;

/** Tabloları ilk kullanımda oluşturur; ayrı bir göç adımına gerek kalmaz. */
export function initSchema(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        phone         TEXT NOT NULL,
        phone_key     TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'arici',
        status        TEXT NOT NULL DEFAULT 'beklemede',
        staff_code    TEXT UNIQUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        decided_at    TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS locations (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        lat        DOUBLE PRECISION NOT NULL,
        lng        DOUBLE PRECISION NOT NULL,
        hives      INTEGER,
        place      TEXT NOT NULL DEFAULT '',
        note       TEXT NOT NULL DEFAULT '',
        source     TEXT NOT NULL DEFAULT 'GPS',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    `);
  })();
  return ready;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

/** Telefon numaralarını yalnızca rakamlara indirger; "0555 111 22 33" ile "05551112233" aynı kabul edilir. */
export function normalisePhone(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

interface UserRow {
  id: string;
  name: string;
  phone: string;
  password_hash: string;
  password_salt: string;
  role: UserRole;
  status: UserStatus;
  staff_code: string | null;
  created_at: Date;
  decided_at: Date | null;
}

function toUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    role: row.role,
    status: row.status,
    staffCode: row.staff_code,
    createdAt: row.created_at.toISOString(),
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
  };
}

export function publicUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    staffCode: user.staffCode,
    createdAt: user.createdAt,
  };
}

export async function registerUser(name: string, phone: string, password: string) {
  await initSchema();
  const key = normalisePhone(phone);
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // İki eşzamanlı kaydın ikisinin birden kurucu yönetici olmasını engeller.
    await client.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    const existing = await client.query("SELECT 1 FROM users WHERE phone_key = $1", [key]);
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return { error: "Bu telefon numarasıyla bir kayıt zaten var." as const };
    }
    const count = await client.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
    const first = count.rows[0].n === 0;
    const inserted = await client.query<UserRow>(
      `INSERT INTO users (id, name, phone, phone_key, password_hash, password_salt, role, status, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        newId("user"),
        name,
        phone,
        key,
        hash,
        salt,
        first ? "yonetici" : "arici",
        first ? "onayli" : "beklemede",
        first ? new Date() : null,
      ],
    );
    await client.query("COMMIT");
    return { user: toUser(inserted.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyLogin(phone: string, password: string) {
  await initSchema();
  const result = await pool.query<UserRow>("SELECT * FROM users WHERE phone_key = $1", [
    normalisePhone(phone),
  ]);
  if (!result.rowCount) return { error: "Telefon veya parola hatalı." as const };
  const user = toUser(result.rows[0]);
  const attempt = Buffer.from(hashPassword(password, user.passwordSalt), "hex");
  const expected = Buffer.from(user.passwordHash, "hex");
  if (attempt.length !== expected.length || !crypto.timingSafeEqual(attempt, expected)) {
    return { error: "Telefon veya parola hatalı." as const };
  }
  return { user };
}

export async function createSession(userId: string): Promise<string> {
  await initSchema();
  const token = crypto.randomBytes(32).toString("hex");
  await pool.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)", [
    token,
    userId,
    new Date(Date.now() + SESSION_MS),
  ]);
  return token;
}

export async function userForToken(token: string | undefined): Promise<StoredUser | null> {
  if (!token) return null;
  await initSchema();
  const result = await pool.query<UserRow>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  );
  return result.rowCount ? toUser(result.rows[0]) : null;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await initSchema();
  await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function listUsers(): Promise<StoredUser[]> {
  await initSchema();
  const result = await pool.query<UserRow>("SELECT * FROM users ORDER BY created_at ASC");
  return result.rows.map(toUser);
}

export async function decideUser(userId: string, approve: boolean, asStaff: boolean) {
  await initSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    const current = await client.query<UserRow>("SELECT * FROM users WHERE id = $1", [userId]);
    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return { error: "Kullanıcı bulunamadı." as const };
    }
    let staffCode = current.rows[0].staff_code;
    let role: UserRole = current.rows[0].role;
    if (approve && asStaff) {
      role = "personel";
      if (!staffCode) {
        // Kilit sayesinde iki onay aynı kodu üretemez.
        const highest = await client.query<{ n: number }>(
          `SELECT COALESCE(MAX(NULLIF(regexp_replace(staff_code, '\\D', '', 'g'), '')::int), 0) AS n FROM users`,
        );
        staffCode = `P-${String(highest.rows[0].n + 1).padStart(3, "0")}`;
      }
    }
    const updated = await client.query<UserRow>(
      `UPDATE users SET status = $2, role = $3, staff_code = $4, decided_at = now()
       WHERE id = $1 RETURNING *`,
      [userId, approve ? "onayli" : "reddedildi", role, staffCode],
    );
    await client.query("COMMIT");
    return { user: toUser(updated.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertLocation(
  userId: string,
  input: { lat: number; lng: number; hives?: number | null; place?: string; note?: string; source?: string },
): Promise<StoredLocation> {
  await initSchema();
  const result = await pool.query(
    `INSERT INTO locations (id, user_id, lat, lng, hives, place, note, source, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (user_id) DO UPDATE SET
       lat = EXCLUDED.lat, lng = EXCLUDED.lng, hives = EXCLUDED.hives,
       place = EXCLUDED.place, note = EXCLUDED.note, source = EXCLUDED.source,
       updated_at = now()
     RETURNING *`,
    [
      newId("loc"),
      userId,
      input.lat,
      input.lng,
      typeof input.hives === "number" ? input.hives : null,
      input.place || "",
      input.note || "",
      input.source || "GPS",
    ],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    lat: row.lat,
    lng: row.lng,
    hives: row.hives,
    place: row.place,
    note: row.note,
    source: row.source,
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Görünürlük kuralı burada uygulanır.
 * Personel ve yönetici tüm konumları görür; arıcı yalnızca kendi kaydını.
 * Kural istemciye bırakılmaz, çünkü istemci tarafı filtre güvenlik sınırı değildir.
 */
export async function locationsVisibleTo(user: StoredUser) {
  await initSchema();
  const privileged = user.role === "personel" || user.role === "yonetici";
  const result = await pool.query(
    `SELECT l.*, u.name AS owner_name, u.phone AS owner_phone
     FROM locations l JOIN users u ON u.id = l.user_id
     ${privileged ? "" : "WHERE l.user_id = $1"}
     ORDER BY l.updated_at DESC`,
    privileged ? [] : [user.id],
  );
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    lat: row.lat,
    lng: row.lng,
    hives: row.hives,
    place: row.place,
    note: row.note,
    source: row.source,
    updatedAt: row.updated_at.toISOString(),
    ownerName: row.owner_name as string,
    // Telefon numarası yalnızca yetkili rollere döner.
    ownerPhone: privileged ? (row.owner_phone as string) : null,
  }));
}

/** Süresi dolmuş oturumları temizler. */
export async function purgeExpiredSessions(): Promise<void> {
  await initSchema();
  await pool.query("DELETE FROM sessions WHERE expires_at <= now()");
}

/** Yalnızca testler için: tüm tabloları boşaltır. */
export async function resetForTests(): Promise<void> {
  await initSchema();
  await pool.query("TRUNCATE sessions, locations, users RESTART IDENTITY CASCADE");
}
