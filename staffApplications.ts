/**
 * ARICIMAP personel yetki başvuruları.
 *
 * Arıcılar kayıt olur olmaz uygulamayı kullanır. Personel yetkisi ise ayrı bir
 * hattan verilir: başvuran kurum bilgilerini gönderir, yönetici doğrulayıp
 * yetkiyi elle tanımlar. Yetki, arıcıların konum ve iletişim bilgilerine erişim
 * anlamına geldiği için otomatik verilmez.
 */
import crypto from "node:crypto";
import { pool, initSchema } from "./accountStore";
import { initNotificationSchema, notifyUser, assignArea } from "./notifications";

export type ApplicationStatus = "beklemede" | "onaylandi" | "reddedildi";

export interface StaffApplication {
  id: string;
  userId: string;
  applicantName: string;
  institution: string;
  title: string;
  institutionEmail: string;
  province: string | null;
  district: string | null;
  status: ApplicationStatus;
  note: string;
  createdAt: string;
  decidedAt: string | null;
}

export async function initApplicationSchema(): Promise<void> {
  await initSchema();
  await initNotificationSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_applications (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      applicant_name     TEXT NOT NULL,
      institution        TEXT NOT NULL,
      title              TEXT NOT NULL,
      institution_email  TEXT NOT NULL,
      province           TEXT,
      district           TEXT,
      status             TEXT NOT NULL DEFAULT 'beklemede',
      note               TEXT NOT NULL DEFAULT '',
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at         TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS staff_applications_status ON staff_applications(status, created_at DESC);
  `);
  // Aynı kişinin birden çok bekleyen başvurusu olmamalı.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS staff_applications_one_pending
    ON staff_applications(user_id) WHERE status = 'beklemede';
  `);
}

interface Row {
  id: string;
  user_id: string;
  applicant_name: string;
  institution: string;
  title: string;
  institution_email: string;
  province: string | null;
  district: string | null;
  status: ApplicationStatus;
  note: string;
  created_at: Date;
  decided_at: Date | null;
}

function toApplication(row: Row): StaffApplication {
  return {
    id: row.id,
    userId: row.user_id,
    applicantName: row.applicant_name,
    institution: row.institution,
    title: row.title,
    institutionEmail: row.institution_email,
    province: row.province,
    district: row.district,
    status: row.status,
    note: row.note,
    createdAt: row.created_at.toISOString(),
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
  };
}

/** Kurum e-postası biçim kontrolü. Doğrulama değil, yalnızca eleme. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

export async function submitApplication(input: {
  userId: string;
  applicantName: string;
  institution: string;
  title: string;
  institutionEmail: string;
  province?: string | null;
  district?: string | null;
}) {
  await initApplicationSchema();
  const existing = await pool.query(
    `SELECT 1 FROM staff_applications WHERE user_id = $1 AND status = 'beklemede'`,
    [input.userId],
  );
  if (existing.rowCount) {
    return { error: "Bekleyen bir başvurun zaten var." as const };
  }
  const result = await pool.query<Row>(
    `INSERT INTO staff_applications
       (id, user_id, applicant_name, institution, title, institution_email, province, district)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      `app_${crypto.randomBytes(9).toString("hex")}`,
      input.userId,
      input.applicantName,
      input.institution,
      input.title,
      input.institutionEmail,
      input.province ?? null,
      input.district ?? null,
    ],
  );
  return { application: toApplication(result.rows[0]) };
}

export async function listApplications(status?: ApplicationStatus): Promise<StaffApplication[]> {
  await initApplicationSchema();
  const result = await pool.query<Row>(
    status
      ? `SELECT * FROM staff_applications WHERE status = $1 ORDER BY created_at DESC`
      : `SELECT * FROM staff_applications ORDER BY created_at DESC`,
    status ? [status] : [],
  );
  return result.rows.map(toApplication);
}

async function nextStaffCode(): Promise<string> {
  const result = await pool.query<{ n: number }>(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(staff_code, '\\D', '', 'g'), '')::int), 0) AS n FROM users`,
  );
  return `P-${String(result.rows[0].n + 1).padStart(3, "0")}`;
}

/**
 * Başvuruyu karara bağlar. Onay hâlinde kullanıcı personel rolüne yükseltilir,
 * personel kodu üretilir ve sorumlu olduğu ilçe atanır.
 */
export async function decideApplication(
  applicationId: string,
  approve: boolean,
  options: { province?: string | null; district?: string | null; note?: string } = {},
) {
  await initApplicationSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    const found = await client.query<Row>(`SELECT * FROM staff_applications WHERE id = $1`, [
      applicationId,
    ]);
    if (!found.rowCount) {
      await client.query("ROLLBACK");
      return { error: "Başvuru bulunamadı." as const };
    }
    const application = found.rows[0];
    if (application.status !== "beklemede") {
      await client.query("ROLLBACK");
      return { error: "Bu başvuru zaten karara bağlanmış." as const };
    }

    const province = options.province ?? application.province;
    const district = options.district ?? application.district;

    if (approve) {
      const current = await client.query<{ staff_code: string | null }>(
        `SELECT staff_code FROM users WHERE id = $1`,
        [application.user_id],
      );
      let code = current.rows[0]?.staff_code;
      if (!code) {
        const highest = await client.query<{ n: number }>(
          `SELECT COALESCE(MAX(NULLIF(regexp_replace(staff_code, '\\D', '', 'g'), '')::int), 0) AS n FROM users`,
        );
        code = `P-${String(highest.rows[0].n + 1).padStart(3, "0")}`;
      }
      await client.query(
        `UPDATE users SET role = 'personel', status = 'onayli', staff_code = $2,
           province = $3, district = $4, decided_at = now() WHERE id = $1`,
        [application.user_id, code, province, district],
      );
    }

    const updated = await client.query<Row>(
      `UPDATE staff_applications SET status = $2, note = $3, province = $4, district = $5,
         decided_at = now() WHERE id = $1 RETURNING *`,
      [
        applicationId,
        approve ? "onaylandi" : "reddedildi",
        options.note || "",
        province,
        district,
      ],
    );
    await client.query("COMMIT");

    await notifyUser(
      application.user_id,
      "sistem",
      approve ? "Personel yetkin tanımlandı" : "Personel başvurun reddedildi",
      approve
        ? `Sorumlu olduğun bölge: ${district || "atanmadı"}`
        : options.note || "Başvurun yönetici tarafından uygun bulunmadı.",
    );

    return { application: toApplication(updated.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export { nextStaffCode, assignArea };
