/**
 * ARICIMAP saha çalışması katmanı.
 *
 * İki ayrı kayıt türü vardır:
 *
 * 1. Ziyaret kaydı — belirli bir arıcının konumuna bağlıdır. Personel "gidildi"
 *    işaretler, sayım yapar, not düşer. Haritadaki işaretin rengini bu belirler.
 * 2. Not defteri — personelin kendi serbest notları. Bir konuma bağlı olmak
 *    zorunda değildir; günlük tutmak, hatırlatma yazmak için kullanılır.
 *
 * Not defteri kayıtları kişiye özeldir: başka personel göremez, yönetici de
 * göremez. Aksi hâlde defter işlevini yitirir.
 */
import crypto from "node:crypto";
import { pool, initSchema, type StoredUser } from "./accountStore";
import { initNotificationSchema } from "./notifications";

export type VisitStatus = "gidildi" | "gidilmedi";

export interface VisitRecord {
  id: string;
  locationId: string;
  staffId: string;
  staffName: string;
  status: VisitStatus;
  hiveCount: number | null;
  note: string;
  createdAt: string;
}

export interface NotebookEntry {
  id: string;
  staffId: string;
  title: string;
  body: string;
  district: string | null;
  locationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function initFieldworkSchema(): Promise<void> {
  await initSchema();
  await initNotificationSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id          TEXT PRIMARY KEY,
      location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      staff_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'gidildi',
      hive_count  INTEGER,
      note        TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS visits_location ON visits(location_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS notebook (
      id          TEXT PRIMARY KEY,
      staff_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT NOT NULL DEFAULT '',
      body        TEXT NOT NULL DEFAULT '',
      district    TEXT,
      location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS notebook_staff ON notebook(staff_id, updated_at DESC);
  `);
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

// --- Ziyaret kayıtları ------------------------------------------------------

export async function recordVisit(
  staffId: string,
  locationId: string,
  input: { status?: VisitStatus; hiveCount?: number | null; note?: string },
) {
  await initFieldworkSchema();
  const exists = await pool.query(`SELECT 1 FROM locations WHERE id = $1`, [locationId]);
  if (!exists.rowCount) return { error: "Konum bulunamadı." as const };

  const result = await pool.query(
    `INSERT INTO visits (id, location_id, staff_id, status, hive_count, note)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      newId("visit"),
      locationId,
      staffId,
      input.status || "gidildi",
      typeof input.hiveCount === "number" ? input.hiveCount : null,
      input.note || "",
    ],
  );
  const row = result.rows[0];
  return {
    visit: {
      id: row.id,
      locationId: row.location_id,
      staffId: row.staff_id,
      staffName: "",
      status: row.status as VisitStatus,
      hiveCount: row.hive_count,
      note: row.note,
      createdAt: row.created_at.toISOString(),
    } satisfies VisitRecord,
  };
}

export async function visitsForLocation(locationId: string): Promise<VisitRecord[]> {
  await initFieldworkSchema();
  const result = await pool.query(
    `SELECT v.*, u.name AS staff_name FROM visits v
     JOIN users u ON u.id = v.staff_id
     WHERE v.location_id = $1 ORDER BY v.created_at DESC`,
    [locationId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    locationId: row.location_id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    status: row.status,
    hiveCount: row.hive_count,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  }));
}

/**
 * Personelin göreceği konum listesi.
 *
 * Personel yalnızca sorumlu olduğu ilçedeki konumları görür; yönetici hepsini.
 * "tespit edildi" durumu, o konuma ait en son ziyaret kaydından türetilir —
 * haritadaki kırmızı/yeşil ayrımı budur.
 */
export async function locationsForFieldwork(
  user: StoredUser & { district?: string | null },
  filter: "hepsi" | "tespit_edilen" | "tespit_edilmeyen" = "hepsi",
) {
  await initFieldworkSchema();
  const isAdmin = user.role === "yonetici";
  const isStaff = user.role === "personel";
  if (!isAdmin && !isStaff) return [];

  const params: unknown[] = [];
  let areaClause = "";
  if (isStaff) {
    // İlçesi atanmamış personel hiçbir konum görmez; yetki belirsiz kalmasın.
    if (!user.district) return [];
    params.push(user.district);
    // Konumun ilçesi, arıcının kendi beyanıdır.
    areaClause = `WHERE l.district = $${params.length}`;
  }

  const result = await pool.query(
    `WITH son_ziyaret AS (
       SELECT DISTINCT ON (location_id) location_id, status, hive_count, note, created_at, staff_id
       FROM visits ORDER BY location_id, created_at DESC
     )
     SELECT l.*, u.name AS owner_name, u.phone AS owner_phone,
            z.status AS visit_status, z.hive_count AS visit_hives,
            z.note AS visit_note, z.created_at AS visit_at
     FROM locations l
     JOIN users u ON u.id = l.user_id
     LEFT JOIN son_ziyaret z ON z.location_id = l.id
     ${areaClause}
     ORDER BY l.updated_at DESC`,
    params,
  );

  const rows = result.rows.map((row) => ({
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
    ownerPhone: row.owner_phone as string,
    province: (row.province as string) || null,
    district: (row.district as string) || null,
    inspected: row.visit_status === "gidildi",
    lastVisit: row.visit_at
      ? {
          status: row.visit_status as VisitStatus,
          hiveCount: row.visit_hives as number | null,
          note: row.visit_note as string,
          at: (row.visit_at as Date).toISOString(),
        }
      : null,
  }));

  if (filter === "tespit_edilen") return rows.filter((r) => r.inspected);
  if (filter === "tespit_edilmeyen") return rows.filter((r) => !r.inspected);
  return rows;
}

/** Personelin bir konuma müdahale yetkisi var mı? */
export async function canWorkOnLocation(
  user: StoredUser & { district?: string | null },
  locationId: string,
): Promise<boolean> {
  if (user.role === "yonetici") return true;
  if (user.role !== "personel" || !user.district) return false;
  const visible = await locationsForFieldwork(user);
  return visible.some((row) => row.id === locationId);
}

// --- Not defteri ------------------------------------------------------------

export async function addNote(
  staffId: string,
  input: { title?: string; body?: string; district?: string | null; locationId?: string | null },
): Promise<NotebookEntry> {
  await initFieldworkSchema();
  const result = await pool.query(
    `INSERT INTO notebook (id, staff_id, title, body, district, location_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      newId("note"),
      staffId,
      input.title || "",
      input.body || "",
      input.district ?? null,
      input.locationId ?? null,
    ],
  );
  return toNote(result.rows[0]);
}

function toNote(row: Record<string, unknown>): NotebookEntry {
  return {
    id: row.id as string,
    staffId: row.staff_id as string,
    title: row.title as string,
    body: row.body as string,
    district: (row.district as string) || null,
    locationId: (row.location_id as string) || null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function listNotes(staffId: string, limit = 200): Promise<NotebookEntry[]> {
  await initFieldworkSchema();
  const result = await pool.query(
    `SELECT * FROM notebook WHERE staff_id = $1 ORDER BY updated_at DESC LIMIT $2`,
    [staffId, Math.min(limit, 500)],
  );
  return result.rows.map(toNote);
}

/** Not yalnızca sahibi tarafından değiştirilebilir. */
export async function updateNote(
  staffId: string,
  noteId: string,
  input: { title?: string; body?: string },
) {
  await initFieldworkSchema();
  const result = await pool.query(
    `UPDATE notebook SET
       title = COALESCE($3, title),
       body = COALESCE($4, body),
       updated_at = now()
     WHERE id = $2 AND staff_id = $1 RETURNING *`,
    [staffId, noteId, input.title ?? null, input.body ?? null],
  );
  if (!result.rowCount) return { error: "Not bulunamadı." as const };
  return { note: toNote(result.rows[0]) };
}

export async function deleteNote(staffId: string, noteId: string): Promise<boolean> {
  await initFieldworkSchema();
  const result = await pool.query(`DELETE FROM notebook WHERE id = $1 AND staff_id = $2`, [
    noteId,
    staffId,
  ]);
  return (result.rowCount || 0) > 0;
}
