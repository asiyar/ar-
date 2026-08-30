/**
 * ARICIMAP konaklama talepleri.
 *
 * Gezginci arıcı, gideceği bölgede yer olup olmadığını sorar. Talep, konumun
 * düştüğü ilçenin sorumlusuna bildirilir; personel veya yönetici karara bağlar.
 *
 * Görünürlük kuralı konum kayıtlarıyla aynıdır: arıcı yalnızca kendi taleplerini
 * görür, personel yalnızca kendi ilçesindekileri, yönetici hepsini.
 */
import crypto from "node:crypto";
import { pool, initSchema, type StoredUser } from "./accountStore";
import { districtForPoint } from "./districts";
import { notifyArea, notifyUser } from "./notifications";

export type StayStatus = "beklemede" | "yer_ayrildi" | "yer_yok";

export interface StayRequest {
  id: string;
  userId: string;
  ownerName: string;
  ownerPhone: string | null;
  lat: number;
  lng: number;
  district: string | null;
  hives: number | null;
  fromDate: string | null;
  toDate: string | null;
  note: string;
  status: StayStatus;
  decisionNote: string;
  decidedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export async function initStaySchema(): Promise<void> {
  await initSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stay_requests (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lat           DOUBLE PRECISION NOT NULL,
      lng           DOUBLE PRECISION NOT NULL,
      district      TEXT,
      hives         INTEGER,
      from_date     DATE,
      to_date       DATE,
      note          TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'beklemede',
      decision_note TEXT NOT NULL DEFAULT '',
      decided_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at    TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS stay_district ON stay_requests(district, status);
  `);
}

function toStay(row: Record<string, unknown>, showPhone: boolean): StayRequest {
  const date = (value: unknown) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : (value as string) || null;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    ownerName: (row.owner_name as string) || "",
    ownerPhone: showPhone ? ((row.owner_phone as string) || null) : null,
    lat: row.lat as number,
    lng: row.lng as number,
    district: (row.district as string) || null,
    hives: (row.hives as number) ?? null,
    fromDate: date(row.from_date),
    toDate: date(row.to_date),
    note: row.note as string,
    status: row.status as StayStatus,
    decisionNote: row.decision_note as string,
    decidedBy: (row.decided_by as string) || null,
    createdAt: (row.created_at as Date).toISOString(),
    decidedAt: row.decided_at ? (row.decided_at as Date).toISOString() : null,
  };
}

export async function createStayRequest(
  user: StoredUser,
  input: {
    lat: number;
    lng: number;
    hives?: number | null;
    fromDate?: string | null;
    toDate?: string | null;
    note?: string;
  },
) {
  await initStaySchema();
  // İlçe koordinattan bulunur; istemcinin gönderdiği bilgiye güvenilmez.
  const area = await districtForPoint(input.lat, input.lng);
  const result = await pool.query(
    `INSERT INTO stay_requests (id, user_id, lat, lng, district, hives, from_date, to_date, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      `stay_${crypto.randomBytes(9).toString("hex")}`,
      user.id,
      input.lat,
      input.lng,
      area ? area.name : null,
      typeof input.hives === "number" ? input.hives : null,
      input.fromDate || null,
      input.toDate || null,
      input.note || "",
    ],
  );

  await notifyArea({
    kind: "konaklama",
    title: `${user.name} konaklama talebi oluşturdu`,
    body:
      (area ? area.name + " · " : "") +
      (input.hives ? input.hives + " kovan" : "") +
      (input.fromDate ? " · " + input.fromDate : ""),
    lat: input.lat,
    lng: input.lng,
    actorId: user.id,
  });

  const row = { ...result.rows[0], owner_name: user.name, owner_phone: user.phone };
  return { request: toStay(row, true) };
}

export async function listStayRequests(
  user: StoredUser & { district?: string | null },
  status?: StayStatus,
): Promise<StayRequest[]> {
  await initStaySchema();
  const isAdmin = user.role === "yonetici";
  const isStaff = user.role === "personel";

  const where: string[] = [];
  const params: unknown[] = [];

  if (isAdmin) {
    // Kısıt yok.
  } else if (isStaff) {
    if (!user.district) return [];
    params.push(user.district);
    where.push(`s.district = $${params.length}`);
  } else {
    params.push(user.id);
    where.push(`s.user_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`s.status = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT s.*, u.name AS owner_name, u.phone AS owner_phone
     FROM stay_requests s JOIN users u ON u.id = s.user_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY s.created_at DESC LIMIT 200`,
    params,
  );
  return result.rows.map((row) => toStay(row, isAdmin || isStaff));
}

/** Personel yalnızca kendi ilçesindeki talebi karara bağlayabilir. */
export async function decideStayRequest(
  user: StoredUser & { district?: string | null },
  requestId: string,
  status: StayStatus,
  decisionNote = "",
) {
  await initStaySchema();
  const found = await pool.query(`SELECT * FROM stay_requests WHERE id = $1`, [requestId]);
  if (!found.rowCount) return { error: "Talep bulunamadı." as const };
  const request = found.rows[0];

  if (user.role === "personel") {
    if (!user.district || request.district !== user.district) {
      return { error: "Bu talep sorumlu olduğun bölgede değil." as const };
    }
  } else if (user.role !== "yonetici") {
    return { error: "Bu işlem personel ve yöneticiye açıktır." as const };
  }

  const updated = await pool.query(
    `UPDATE stay_requests SET status = $2, decision_note = $3, decided_by = $4, decided_at = now()
     WHERE id = $1 RETURNING *`,
    [requestId, status, decisionNote, user.id],
  );

  await notifyUser(
    request.user_id,
    "konaklama",
    status === "yer_ayrildi" ? "Konaklama talebin onaylandı" : "Konaklama talebin karara bağlandı",
    decisionNote || (status === "yer_ayrildi" ? "Bölgede yer ayrıldı." : "Bölgede uygun yer bulunamadı."),
  );

  const owner = await pool.query(`SELECT name, phone FROM users WHERE id = $1`, [request.user_id]);
  return {
    request: toStay(
      { ...updated.rows[0], owner_name: owner.rows[0]?.name, owner_phone: owner.rows[0]?.phone },
      true,
    ),
  };
}
