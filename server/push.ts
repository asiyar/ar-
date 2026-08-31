/**
 * ARICIMAP anlık bildirim (push) katmanı.
 *
 * Uygulama içi mesaj kutusu yalnızca kullanıcı uygulamayı açtığında görülür.
 * Saha personelinin bölgesindeki bir hareketten anında haberdar olması için
 * telefonun kilit ekranında bildirim çıkması gerekir; bunu Firebase Cloud
 * Messaging (FCM) sağlar.
 *
 * Yapılandırma yoksa katman sessizce devre dışı kalır: uygulama çalışmaya
 * devam eder, yalnızca kilit ekranı bildirimi çıkmaz. Bildirimin gönderilememesi
 * hiçbir zaman asıl işlemi (konum kaydı, konaklama talebi) düşürmemelidir.
 */
import crypto from "node:crypto";
import { pool, initSchema } from "./accountStore";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let serviceAccount: ServiceAccount | null = null;
let yapilandirmaOkundu = false;

function readServiceAccount(): ServiceAccount | null {
  if (yapilandirmaOkundu) return serviceAccount;
  yapilandirmaOkundu = true;
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      console.warn("FCM_SERVICE_ACCOUNT eksik alan içeriyor; push kapalı.");
      return null;
    }
    // Ortam değişkenlerinde satır sonları çoğu zaman \n olarak kaçırılır.
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    serviceAccount = parsed;
    return serviceAccount;
  } catch (error) {
    console.warn("FCM_SERVICE_ACCOUNT çözümlenemedi; push kapalı.", error);
    return null;
  }
}

export function pushEnabled(): boolean {
  return readServiceAccount() !== null;
}

export async function initPushSchema(): Promise<void> {
  await initSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform   TEXT NOT NULL DEFAULT 'android',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS push_tokens_user ON push_tokens(user_id);
  `);
}

/** Cihaz jetonu kaydeder. Aynı jeton başka hesaba geçtiyse sahibi güncellenir. */
export async function registerToken(userId: string, token: string, platform = "android") {
  await initPushSchema();
  await pool.query(
    `INSERT INTO push_tokens (token, user_id, platform)
     VALUES ($1,$2,$3)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, last_seen = now()`,
    [token, userId, platform],
  );
}

export async function removeToken(token: string): Promise<void> {
  await initPushSchema();
  await pool.query(`DELETE FROM push_tokens WHERE token = $1`, [token]);
}

export async function tokensFor(userIds: string[]): Promise<{ token: string; userId: string }[]> {
  if (!userIds.length) return [];
  await initPushSchema();
  const result = await pool.query<{ token: string; user_id: string }>(
    `SELECT token, user_id FROM push_tokens WHERE user_id = ANY($1)`,
    [userIds],
  );
  return result.rows.map((r) => ({ token: r.token, userId: r.user_id }));
}

// --- Google erişim jetonu ---------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Servis hesabıyla OAuth2 erişim jetonu alır. Jeton bir saat geçerlidir;
 * her bildirimde yeniden istenmemesi için önbelleğe alınır.
 */
async function accessToken(): Promise<string | null> {
  const account = readServiceAccount();
  if (!account) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = base64url(signer.sign(account.private_key));
  const assertion = `${header}.${claim}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    console.warn("FCM erişim jetonu alınamadı:", response.status, await response.text());
    return null;
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

// --- Gönderim ---------------------------------------------------------------

export interface PushMesaji {
  title: string;
  body: string;
  /** Bildirime dokununca açılacak sayfa. */
  page?: string;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Belirtilen kullanıcılara anlık bildirim gönderir.
 * Geçersiz jetonlar veritabanından silinir; uygulama kaldırılan cihazlara
 * sürekli gönderim denemesi yapılmaz.
 */
export async function sendPush(userIds: string[], mesaj: PushMesaji): Promise<number> {
  if (!pushEnabled() || !userIds.length) return 0;
  const account = readServiceAccount();
  const yetki = await accessToken();
  if (!account || !yetki) return 0;

  const hedefler = await tokensFor(userIds);
  if (!hedefler.length) return 0;

  const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  let gonderilen = 0;

  for (const hedef of hedefler) {
    const govde = {
      message: {
        token: hedef.token,
        notification: { title: mesaj.title, body: mesaj.body },
        data: {
          page: mesaj.page || "kutu",
          lat: mesaj.lat === null || mesaj.lat === undefined ? "" : String(mesaj.lat),
          lng: mesaj.lng === null || mesaj.lng === undefined ? "" : String(mesaj.lng),
        },
        android: {
          priority: "HIGH",
          notification: { channelId: "aricimap", sound: "default" },
        },
      },
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${yetki}`, "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      if (response.ok) {
        gonderilen += 1;
        continue;
      }
      // 404 ve 403: jeton artık geçerli değil (uygulama silinmiş olabilir).
      if (response.status === 404 || response.status === 403) {
        await removeToken(hedef.token);
        continue;
      }
      console.warn("FCM gönderim hatası:", response.status, await response.text());
    } catch (error) {
      console.warn("FCM isteği başarısız:", error);
    }
  }
  return gonderilen;
}
