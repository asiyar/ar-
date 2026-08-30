/**
 * ARICIMAP duyuru ve reklam katmanı.
 *
 * İkisi de yöneticinin yönettiği, herkese açık içeriktir: arıcı da personel de
 * görür. Konum verisinden farklı olarak burada görünürlük kısıtı yoktur.
 *
 * Reklam görselleri veritabanına gömülmez; yalnızca bağlantı ve metin saklanır.
 * Base64 görselleri satır içinde tutmak veritabanını hızla şişirir.
 */
import crypto from "node:crypto";
import { pool, initSchema } from "./accountStore";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: "bilgi" | "uyari" | "acil";
  /** Boş ise duyuru Türkiye geneline yayınlanmıştır. */
  province: string | null;
  district: string | null;
  active: boolean;
  createdAt: string;
}

export interface Ad {
  id: string;
  company: string;
  title: string;
  description: string;
  cta: string;
  website: string;
  phone: string;
  whatsapp: string;
  imageUrl: string;
  status: "active" | "paused";
  startsOn: string | null;
  endsOn: string | null;
  impressions: number;
  clicks: number;
  createdAt: string;
}

export async function initContentSchema(): Promise<void> {
  await initSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      level      TEXT NOT NULL DEFAULT 'bilgi',
      province   TEXT,
      district   TEXT,
      active     BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE announcements ADD COLUMN IF NOT EXISTS province TEXT;
    ALTER TABLE announcements ADD COLUMN IF NOT EXISTS district TEXT;
    CREATE TABLE IF NOT EXISTS ads (
      id          TEXT PRIMARY KEY,
      company     TEXT NOT NULL,
      title       TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cta         TEXT NOT NULL DEFAULT '',
      website     TEXT NOT NULL DEFAULT '',
      phone       TEXT NOT NULL DEFAULT '',
      whatsapp    TEXT NOT NULL DEFAULT '',
      image_url   TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'active',
      starts_on   DATE,
      ends_on     DATE,
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks      INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

/** Yalnızca http ve https bağlantılarına izin verilir. */
export function safeUrl(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

// --- Duyurular --------------------------------------------------------------

function toAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    level: row.level as Announcement["level"],
    province: (row.province as string) || null,
    district: (row.district as string) || null,
    active: row.active as boolean,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function createAnnouncement(input: {
  title: string;
  body?: string;
  level?: Announcement["level"];
  province?: string | null;
  district?: string | null;
}): Promise<Announcement> {
  await initContentSchema();
  const level = ["bilgi", "uyari", "acil"].includes(input.level || "") ? input.level : "bilgi";
  const result = await pool.query(
    `INSERT INTO announcements (id, title, body, level, province, district)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      newId("duyuru"),
      input.title,
      input.body || "",
      level,
      input.province || null,
      // İlçe, il olmadan anlamsızdır.
      input.province ? input.district || null : null,
    ],
  );
  return toAnnouncement(result.rows[0]);
}

/**
 * Kullanıcıya gösterilecek duyurular.
 *
 * Türkiye geneli duyurular herkese gider. İl duyurusu yalnızca o ildekilere,
 * ilçe duyurusu yalnızca o ilçedekilere. Bölgesi belirsiz kullanıcı yalnızca
 * genel duyuruları görür.
 */
export async function announcementsFor(
  scope: { province?: string | null; district?: string | null },
): Promise<Announcement[]> {
  await initContentSchema();
  const result = await pool.query(
    `SELECT * FROM announcements
     WHERE active
       AND (province IS NULL OR province = $1)
       AND (district IS NULL OR district = $2)
     ORDER BY created_at DESC LIMIT 30`,
    [scope.province || null, scope.district || null],
  );
  return result.rows.map(toAnnouncement);
}

export async function listAnnouncements(onlyActive = false): Promise<Announcement[]> {
  await initContentSchema();
  const result = await pool.query(
    onlyActive
      ? `SELECT * FROM announcements WHERE active ORDER BY created_at DESC LIMIT 30`
      : `SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100`,
  );
  return result.rows.map(toAnnouncement);
}

export async function setAnnouncementActive(id: string, active: boolean) {
  await initContentSchema();
  const result = await pool.query(
    `UPDATE announcements SET active = $2 WHERE id = $1 RETURNING *`,
    [id, active],
  );
  if (!result.rowCount) return { error: "Duyuru bulunamadı." as const };
  return { announcement: toAnnouncement(result.rows[0]) };
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  await initContentSchema();
  const result = await pool.query(`DELETE FROM announcements WHERE id = $1`, [id]);
  return (result.rowCount || 0) > 0;
}

// --- Reklamlar --------------------------------------------------------------

function toAd(row: Record<string, unknown>): Ad {
  const date = (value: unknown) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : (value as string) || null;
  return {
    id: row.id as string,
    company: row.company as string,
    title: row.title as string,
    description: row.description as string,
    cta: row.cta as string,
    website: row.website as string,
    phone: row.phone as string,
    whatsapp: row.whatsapp as string,
    imageUrl: row.image_url as string,
    status: row.status as Ad["status"],
    startsOn: date(row.starts_on),
    endsOn: date(row.ends_on),
    impressions: row.impressions as number,
    clicks: row.clicks as number,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function saveAd(input: {
  id?: string | null;
  company: string;
  title?: string;
  description?: string;
  cta?: string;
  website?: string;
  phone?: string;
  whatsapp?: string;
  imageUrl?: string;
  status?: Ad["status"];
  startsOn?: string | null;
  endsOn?: string | null;
}): Promise<Ad> {
  await initContentSchema();
  const values = [
    input.company,
    input.title || "",
    input.description || "",
    input.cta || "",
    safeUrl(input.website || ""),
    (input.phone || "").replace(/[^\d+]/g, ""),
    (input.whatsapp || "").replace(/\D/g, ""),
    safeUrl(input.imageUrl || ""),
    input.status === "paused" ? "paused" : "active",
    input.startsOn || null,
    input.endsOn || null,
  ];

  if (input.id) {
    const result = await pool.query(
      `UPDATE ads SET company=$2, title=$3, description=$4, cta=$5, website=$6,
         phone=$7, whatsapp=$8, image_url=$9, status=$10, starts_on=$11, ends_on=$12
       WHERE id=$1 RETURNING *`,
      [input.id, ...values],
    );
    if (result.rowCount) return toAd(result.rows[0]);
  }

  const result = await pool.query(
    `INSERT INTO ads (id, company, title, description, cta, website, phone, whatsapp,
       image_url, status, starts_on, ends_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [newId("ad"), ...values],
  );
  return toAd(result.rows[0]);
}

export async function listAds(): Promise<Ad[]> {
  await initContentSchema();
  const result = await pool.query(`SELECT * FROM ads ORDER BY created_at DESC`);
  return result.rows.map(toAd);
}

export async function deleteAd(id: string): Promise<boolean> {
  await initContentSchema();
  const result = await pool.query(`DELETE FROM ads WHERE id = $1`, [id]);
  return (result.rowCount || 0) > 0;
}

/**
 * Panoda gösterilecek reklamı seçer.
 * Duraklatılmış veya tarihi geçmiş reklamlar elenir; kalanlar arasından
 * en az gösterilmiş olan seçilir, böylece gösterim dengeli dağılır.
 */
export async function activeAd(): Promise<Ad | null> {
  await initContentSchema();
  const today = new Date().toISOString().slice(0, 10);
  const result = await pool.query(
    `SELECT * FROM ads
     WHERE status = 'active'
       AND (starts_on IS NULL OR starts_on <= $1::date)
       AND (ends_on   IS NULL OR ends_on   >= $1::date)
     ORDER BY impressions ASC, created_at DESC
     LIMIT 1`,
    [today],
  );
  if (!result.rowCount) return null;
  const ad = toAd(result.rows[0]);
  await pool.query(`UPDATE ads SET impressions = impressions + 1 WHERE id = $1`, [ad.id]);
  return ad;
}

export async function countClick(id: string): Promise<void> {
  await initContentSchema();
  await pool.query(`UPDATE ads SET clicks = clicks + 1 WHERE id = $1`, [id]);
}
