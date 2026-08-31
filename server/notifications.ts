/**
 * ARICIMAP bildirim katmanı.
 *
 * Bildirimler tüm personele gitmez. Bir olay hangi ilçe sınırları içinde
 * gerçekleştiyse, yalnızca o ilçeye atanmış personele ve yöneticilere iletilir.
 *
 * Not: bunlar uygulama içi bildirimlerdir. Telefon kilit ekranında beliren
 * anlık bildirim (push) için ayrıca Firebase/APNs kurulumu gerekir; bu katman
 * onun da temelini oluşturur ama kendisi push göndermez.
 */
import crypto from "node:crypto";
import { pool, initSchema, type StoredUser } from "./accountStore";
import { sendPush } from "./push";


export type NotificationKind = "konum" | "konaklama" | "denetim" | "sistem";

export interface StoredNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  province: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
  readAt: string | null;
  createdAt: string;
}

export async function initNotificationSchema(): Promise<void> {
  await initSchema();
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS province TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS district TEXT;
    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      province   TEXT,
      district   TEXT,
      lat        DOUBLE PRECISION,
      lng        DOUBLE PRECISION,
      read_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, created_at DESC);
  `);
}

function newId(): string {
  return `ntf_${crypto.randomBytes(9).toString("hex")}`;
}

interface Row {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  province: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
  read_at: Date | null;
  created_at: Date;
}

function toNotification(row: Row): StoredNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    province: row.province,
    district: row.district,
    lat: row.lat,
    lng: row.lng,
    readAt: row.read_at ? row.read_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Bir olayın bildirileceği kişileri belirler.
 *
 * - Yöneticiler her olayı görür; ilin tamamından sorumludurlar.
 * - Personel yalnızca kendi ilçesindeki olayları görür.
 * - İlçesi atanmamış personel hiçbir konum bildirimi almaz. Bu bilinçlidir:
 *   atama yapılmadan herkese göndermek, tam da kaçınmak istediğimiz davranış.
 * - Olayı üreten kişinin kendisi listeye alınmaz.
 */
export async function recipientsForArea(
  district: string | null,
  excludeUserId?: string,
): Promise<StoredUser[]> {
  await initNotificationSchema();
  const result = await pool.query(
    `SELECT * FROM users
     WHERE status = 'onayli'
       AND (role = 'yonetici' OR (role = 'personel' AND district IS NOT NULL AND district = $1))
       AND ($2::text IS NULL OR id <> $2)`,
    [district, excludeUserId ?? null],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    role: row.role,
    status: row.status,
    staffCode: row.staff_code,
    province: row.province ?? null,
    district: row.district ?? null,
    createdAt: row.created_at.toISOString(),
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
  }));
}

/**
 * Konum tabanlı bir olayı ilgili kişilere bildirir.
 * İlçe, koordinattan poligon testiyle bulunur; istemcinin gönderdiği ilçe
 * bilgisine güvenilmez.
 */
export async function notifyArea(input: {
  kind: NotificationKind;
  title: string;
  body?: string;
  lat: number;
  lng: number;
  province?: string | null;
  district?: string | null;
  actorId?: string;
}): Promise<{ district: string | null; delivered: number }> {
  await initNotificationSchema();
  // İlçe, kullanıcının beyanından gelir. Koordinattan poligonla bulma yöntemi
  // dış servise bağımlıydı ve o servise ulaşılamadığında hiçbir bildirim
  // yönlendirilemiyordu.
  const area = input.district
    ? { province: input.province || null, name: input.district }
    : null;
  const recipients = await recipientsForArea(area ? area.name : null, input.actorId);

  for (const person of recipients) {
    await pool.query(
      `INSERT INTO notifications (id, user_id, kind, title, body, province, district, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        newId(),
        person.id,
        input.kind,
        input.title,
        input.body || "",
        area ? area.province : null,
        area ? area.name : null,
        input.lat,
        input.lng,
      ],
    );
  }

  // Kilit ekranı bildirimi. Gönderilemezse kayıt yine de durur; push
  // yapılandırılmamış olabilir ve bu asıl işlemi düşürmemeli.
  try {
    await sendPush(
      recipients.map((p) => p.id),
      { title: input.title, body: input.body || "", page: "kutu", lat: input.lat, lng: input.lng },
    );
  } catch (error) {
    console.warn("Anlık bildirim gönderilemedi:", error);
  }

  return { district: area ? area.name : null, delivered: recipients.length };
}

/** Konumdan bağımsız, belirli bir kişiye bildirim (örneğin onay sonucu). */
export async function notifyUser(
  userId: string,
  kind: NotificationKind,
  title: string,
  body = "",
): Promise<void> {
  await initNotificationSchema();
  await pool.query(
    `INSERT INTO notifications (id, user_id, kind, title, body) VALUES ($1,$2,$3,$4,$5)`,
    [newId(), userId, kind, title, body],
  );
  try {
    await sendPush([userId], { title, body, page: "kutu" });
  } catch (error) {
    console.warn("Anlık bildirim gönderilemedi:", error);
  }
}

export async function listNotifications(userId: string, limit = 50): Promise<StoredNotification[]> {
  await initNotificationSchema();
  const result = await pool.query<Row>(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(limit, 200)],
  );
  return result.rows.map(toNotification);
}

export async function markRead(userId: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  await initNotificationSchema();
  const result = await pool.query(
    `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = ANY($2) AND read_at IS NULL`,
    [userId, ids],
  );
  return result.rowCount || 0;
}

export async function unreadCount(userId: string): Promise<number> {
  await initNotificationSchema();
  const result = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return result.rows[0].n;
}

/** Personelin sorumlu olduğu ilçeyi atar. Yalnızca yönetici çağırır. */
export async function assignArea(
  userId: string,
  province: string | null,
  district: string | null,
): Promise<void> {
  await initNotificationSchema();
  await pool.query(`UPDATE users SET province = $2, district = $3 WHERE id = $1`, [
    userId,
    province,
    district,
  ]);
}
