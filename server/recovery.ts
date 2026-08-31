/**
 * ARICIMAP parola kurtarma.
 *
 * Üç ayrı yol vardır, çünkü tek bir yol her durumu çözmez:
 *
 * 1. Kullanıcı kendi parolasını değiştirir (mevcut parolasını bilerek).
 * 2. Yönetici, bir kullanıcının parolasını sıfırlar.
 * 3. Kurtarma anahtarı: yönetici kendi parolasını unutursa kimse ona yardım
 *    edemez, çünkü onun üstünde yetkili yok. Bu durumda barındırma panelinde
 *    tanımlı gizli bir anahtar ile parola sıfırlanır.
 *
 * SMS veya e-posta ile sıfırlama bilinçli olarak tercih edilmedi: ikisi de
 * ücretli bir servise bağımlıdır ve kurulmadığı sürece hiç çalışmaz. Kurtarma
 * anahtarı ise dışarıya bağımlı değildir.
 */
import crypto from "node:crypto";
import { pool, initSchema, normalisePhone, type StoredUser } from "./accountStore";

/** Anahtar tanımlı değilse kurtarma ucu tamamen kapalıdır. */
export function recoveryEnabled(): boolean {
  return Boolean(process.env.ARICIMAP_RECOVERY_KEY);
}

/**
 * Anahtar karşılaştırması sabit sürede yapılır; aksi hâlde yanıt süresinden
 * anahtarın kaç karakterinin doğru olduğu çıkarılabilir.
 */
function keyMatches(supplied: string): boolean {
  const expected = process.env.ARICIMAP_RECOVERY_KEY || "";
  if (!expected) return false;
  const a = Buffer.from(String(supplied || ""), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

async function writePassword(userId: string, password: string): Promise<void> {
  const salt = crypto.randomBytes(16).toString("hex");
  await pool.query(`UPDATE users SET password_hash = $2, password_salt = $3 WHERE id = $1`, [
    userId,
    hashPassword(password, salt),
    salt,
  ]);
  // Eski oturumlar kapatılır: parola değiştiyse önceki jetonlar geçersiz olmalı.
  await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

export function passwordProblem(password: string): string | null {
  if (typeof password !== "string" || password.length < 6) {
    return "Parola en az 6 karakter olmalı.";
  }
  return null;
}

/** Kullanıcı kendi parolasını değiştirir. */
export async function changeOwnPassword(user: StoredUser, current: string, next: string) {
  await initSchema();
  const attempt = Buffer.from(hashPassword(current, user.passwordSalt), "hex");
  const expected = Buffer.from(user.passwordHash, "hex");
  if (attempt.length !== expected.length || !crypto.timingSafeEqual(attempt, expected)) {
    return { error: "Mevcut parola hatalı." as const };
  }
  const sorun = passwordProblem(next);
  if (sorun) return { error: sorun as string };
  await writePassword(user.id, next);
  return { ok: true as const };
}

/** Yönetici, başka bir kullanıcının parolasını sıfırlar. */
export async function adminResetPassword(targetId: string, next: string) {
  await initSchema();
  const sorun = passwordProblem(next);
  if (sorun) return { error: sorun as string };
  const found = await pool.query(`SELECT id FROM users WHERE id = $1`, [targetId]);
  if (!found.rowCount) return { error: "Kullanıcı bulunamadı." as const };
  await writePassword(targetId, next);
  return { ok: true as const };
}

/**
 * Kurtarma anahtarıyla sıfırlama.
 *
 * Telefonun kayıtlı olup olmadığı bilgisi sızdırılmaz: anahtar yanlışsa da
 * telefon yoksa da aynı hata döner. Aksi hâlde bu uç, kimlerin kayıtlı
 * olduğunu öğrenmek için kullanılabilirdi.
 */
export async function recoverWithKey(suppliedKey: string, phone: string, next: string) {
  await initSchema();
  if (!recoveryEnabled()) {
    return { error: "Kurtarma kapalı. Sunucu ayarlarında ARICIMAP_RECOVERY_KEY tanımlı değil." as const };
  }
  const sorun = passwordProblem(next);
  if (sorun) return { error: sorun as string };

  const anahtarDogru = keyMatches(suppliedKey);
  const found = await pool.query<{ id: string; name: string; role: string }>(
    `SELECT id, name, role FROM users WHERE phone_key = $1`,
    [normalisePhone(phone)],
  );

  if (!anahtarDogru || !found.rowCount) {
    return { error: "Kurtarma anahtarı veya telefon hatalı." as const };
  }

  await writePassword(found.rows[0].id, next);
  return { ok: true as const, name: found.rows[0].name, role: found.rows[0].role };
}

/** Yönetici hesabı hiç kalmadıysa sistem yönetilemez hâle gelir. */
export async function adminCount(): Promise<number> {
  await initSchema();
  const result = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM users WHERE role = 'yonetici'`,
  );
  return result.rows[0].n;
}

/** Kurtarma anahtarıyla bir hesabı yöneticiye yükseltir (son çare). */
export async function promoteWithKey(suppliedKey: string, phone: string) {
  await initSchema();
  if (!recoveryEnabled()) {
    return { error: "Kurtarma kapalı." as const };
  }
  if (!keyMatches(suppliedKey)) {
    return { error: "Kurtarma anahtarı hatalı." as const };
  }
  const found = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM users WHERE phone_key = $1`,
    [normalisePhone(phone)],
  );
  if (!found.rowCount) return { error: "Bu telefonla kayıtlı kullanıcı yok." as const };
  await pool.query(
    `UPDATE users SET role = 'yonetici', status = 'onayli', decided_at = now() WHERE id = $1`,
    [found.rows[0].id],
  );
  return { ok: true as const, name: found.rows[0].name };
}
