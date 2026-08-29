/**
 * ARICIMAP hesap ve konum uç noktaları.
 *
 * Yetki kontrolü burada, sunucu tarafında yapılır. İstemcideki rol seçicisi
 * yalnızca arayüzü biçimlendirir; hangi verinin döneceğine bu dosya karar verir.
 */
import type { Express, Request, Response, NextFunction } from "express";
import {
  registerUser,
  verifyLogin,
  createSession,
  destroySession,
  userForToken,
  listUsers,
  decideUser,
  upsertLocation,
  locationsVisibleTo,
  publicUser,
  type StoredUser,
} from "./accountStore";

const TOKEN_HEADER = "x-aricimap-token";

interface AuthedRequest extends Request {
  user?: StoredUser;
}

function readToken(req: Request): string | undefined {
  const header = req.header(TOKEN_HEADER);
  if (header) return header;
  const auth = req.header("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return undefined;
}

async function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  req.user = (await userForToken(readToken(req))) || undefined;
  next();
}

function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Oturum açmanız gerekiyor." });
    return;
  }
  if (req.user.status !== "onayli") {
    res.status(403).json({ error: "Hesabınız henüz yönetici onayı bekliyor.", status: req.user.status });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "yonetici") {
    res.status(403).json({ error: "Bu işlem yalnızca yöneticiye açıktır." });
    return;
  }
  next();
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function registerAccountRoutes(app: Express) {
  app.use("/api/aricimap", attachUser);

  /** Barındırma uykudan uyanırken istemcinin bekleme ekranını göstermesi için. */
  app.get("/api/aricimap/health", (_req, res) => {
    res.json({ ok: true, at: new Date().toISOString() });
  });

  app.post("/api/aricimap/register", async (req, res) => {
    const name = asText(req.body?.name);
    const phone = asText(req.body?.phone);
    const password = asText(req.body?.password);
    if (name.length < 3) {
      res.status(400).json({ error: "Ad soyad en az 3 karakter olmalı." });
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      res.status(400).json({ error: "Geçerli bir telefon numarası girin." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Parola en az 6 karakter olmalı." });
      return;
    }
    const result = await registerUser(name, phone, password);
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    const token = await createSession(result.user.id);
    res.status(201).json({ token, user: publicUser(result.user) });
  });

  app.post("/api/aricimap/login", async (req, res) => {
    const phone = asText(req.body?.phone);
    const password = asText(req.body?.password);
    const result = await verifyLogin(phone, password);
    if ("error" in result) {
      res.status(401).json({ error: result.error });
      return;
    }
    const token = await createSession(result.user.id);
    res.json({ token, user: publicUser(result.user) });
  });

  app.post("/api/aricimap/logout", async (req, res) => {
    await destroySession(readToken(req));
    res.json({ ok: true });
  });

  app.get("/api/aricimap/me", async (req: AuthedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: "Oturum yok." });
      return;
    }
    res.json({ user: publicUser(req.user) });
  });

  /** Yönetici: bekleyen ve karara bağlanmış tüm kayıtlar. */
  app.get("/api/aricimap/users", requireUser, requireAdmin, async (_req, res) => {
    const users = await listUsers();
    res.json({ users: users.map(publicUser) });
  });

  app.post("/api/aricimap/users/:id/decide", requireUser, requireAdmin, async (req, res) => {
    const approve = req.body?.approve === true;
    const asStaff = req.body?.asStaff === true;
    const result = await decideUser(req.params.id, approve, asStaff);
    if ("error" in result) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ user: publicUser(result.user) });
  });

  /** Kendi konumunu kaydeder veya günceller. */
  app.put("/api/aricimap/location", requireUser, async (req: AuthedRequest, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: "Geçerli bir konum gerekli." });
      return;
    }
    const hivesRaw = req.body?.hives;
    const hives = hivesRaw === null || hivesRaw === undefined || hivesRaw === "" ? null : Number(hivesRaw);
    if (hives !== null && (!Number.isInteger(hives) || hives < 0)) {
      res.status(400).json({ error: "Kovan sayısı 0 veya daha büyük bir tam sayı olmalı." });
      return;
    }
    const record = await upsertLocation(req.user!.id, {
      lat,
      lng,
      hives,
      place: asText(req.body?.place),
      note: asText(req.body?.note),
      source: asText(req.body?.source) || "GPS",
    });
    res.json({ location: record });
  });

  /** Görünürlük kuralı sunucuda uygulanır. */
  app.get("/api/aricimap/locations", requireUser, async (req: AuthedRequest, res) => {
    res.json({ locations: await locationsVisibleTo(req.user!) });
  });
}
