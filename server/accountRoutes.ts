/**
 * ARICIMAP hesap ve konum uç noktaları.
 *
 * Yetki kontrolü burada, sunucu tarafında yapılır. İstemcideki rol seçicisi
 * yalnızca arayüzü biçimlendirir; hangi verinin döneceğine bu dosya karar verir.
 */
import type { Express, Request, Response, NextFunction } from "express";
import {
  createAnnouncement,
  announcementsFor,
  listAnnouncements,
  setAnnouncementActive,
  deleteAnnouncement,
  saveAd,
  listAds,
  deleteAd,
  activeAd,
  countClick,
} from "./content";
import {
  createStayRequest,
  listStayRequests,
  decideStayRequest,
} from "./stayRequests";
import {
  submitApplication,
  listApplications,
  decideApplication,
  looksLikeEmail,
} from "./staffApplications";
import {
  recordVisit,
  visitsForLocation,
  locationsForFieldwork,
  canWorkOnLocation,
  addNote,
  listNotes,
  updateNote,
  deleteNote,
} from "./fieldwork";
import { listDistricts, listProvinces } from "./districts";
import {
  changeOwnPassword,
  adminResetPassword,
  recoverWithKey,
  promoteWithKey,
  recoveryEnabled,
  adminCount,
} from "./recovery";
import { ilVarMi, ilceVarMi } from "./trAdres";
import {
  notifyArea,
  notifyUser,
  listNotifications,
  markRead,
  unreadCount,
  assignArea,
  initNotificationSchema,
} from "./notifications";
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


function requireField(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== "personel" && req.user.role !== "yonetici")) {
    res.status(403).json({ error: "Bu bölüm personel ve yöneticiye açıktır." });
    return;
  }
  next();
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function registerAccountRoutes(app: Express) {
  /**
   * Native kabuk (APK/IPA) sayfayı capacitor://localhost veya https://localhost
   * üzerinden sunar; sunucuya yapılan her istek çapraz kökenlidir. CORS başlığı
   * olmadan tarayıcı isteği engeller ve uygulama sunucuya hiç ulaşamaz.
   *
   * Kimlik jetonu Authorization/x-aricimap-token başlığında taşındığı için
   * çerez gönderilmez; bu yüzden credentials açılmaz ve köken listesi dar tutulur.
   */
  const allowedOrigins = [
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    "https://localhost",
    // Dosyadan açılan HTML "null" köken bildirir. Kimlik jetonu başlıkta
    // taşındığı ve çerez kullanılmadığı için bu kökene izin vermek ek risk
    // yaratmaz: jetonu olmayan bir sayfa hiçbir veriye erişemez.
    "null",
  ];
  app.use("/api/aricimap", (req, res, next) => {
    const origin = req.header("origin");
    if (origin && (allowedOrigins.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin))) {
      // Not: "null" kökene Access-Control-Allow-Origin: null döner; bu geçerlidir.
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-aricimap-token");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

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
    await notifyUser(
      result.user.id,
      "sistem",
      approve ? "Hesabın onaylandı" : "Başvurun reddedildi",
      approve && result.user.staffCode ? `Personel kodun: ${result.user.staffCode}` : "",
    );
    res.json({ user: publicUser(result.user) });
  });

  /** Yönetici: personelin sorumlu olduğu ilçeyi atar. */
  app.post("/api/aricimap/users/:id/area", requireUser, requireAdmin, async (req, res) => {
    const province = asText(req.body?.province) || null;
    const district = asText(req.body?.district) || null;
    await assignArea(req.params.id, province, district);
    res.json({ ok: true, province, district });
  });

  /** İlçe listesi. Harita ve personel ataması bunu kullanır. */
  app.get("/api/aricimap/provinces", async (_req, res) => {
    res.json({ provinces: await listProvinces() });
  });

  app.get("/api/aricimap/districts", async (req, res) => {
    const province = typeof req.query.province === "string" ? req.query.province : undefined;
    res.json({ districts: await listDistricts(province) });
  });

  /** Kullanıcının kendi bildirimleri. */
  app.get("/api/aricimap/notifications", requireUser, async (req: AuthedRequest, res) => {
    res.json({
      notifications: await listNotifications(req.user!.id),
      unread: await unreadCount(req.user!.id),
    });
  });

  app.post("/api/aricimap/notifications/read", requireUser, async (req: AuthedRequest, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === "string") : [];
    res.json({ updated: await markRead(req.user!.id, ids) });
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
    // İl ve ilçe kullanıcının beyanıdır; uydurma değer kabul edilmez.
    const province = asText(req.body?.province);
    const district = asText(req.body?.district);
    if (province && !ilVarMi(province)) {
      res.status(400).json({ error: "Geçersiz il." });
      return;
    }
    if (district && !ilceVarMi(province, district)) {
      res.status(400).json({ error: "Seçilen ilçe bu ile ait değil." });
      return;
    }

    const record = await upsertLocation(req.user!.id, {
      lat,
      lng,
      hives,
      place: asText(req.body?.place),
      note: asText(req.body?.note),
      source: asText(req.body?.source) || "GPS",
      province: province || null,
      district: district || null,
    });
    // Bildirim yalnızca konumun düştüğü ilçenin personeline ve yöneticilere gider.
    // İlçe, koordinattan poligon testiyle bulunur; istemcinin iddiasına güvenilmez.
    let area: { district: string | null; delivered: number } = { district: null, delivered: 0 };
    try {
      area = await notifyArea({
        kind: "konum",
        title: `${req.user!.name} konumunu paylaştı`,
        body: [record.district, record.place].filter(Boolean).join(" · "),
        lat,
        lng,
        province: record.province,
        district: record.district,
        actorId: req.user!.id,
      });
    } catch (error) {
      // Bildirim gönderilemese bile konum kaydı kaybolmamalı.
      console.error("Bildirim gönderilemedi:", error);
    }
    res.json({ location: record, district: area.district, notified: area.delivered });
  });

  /** Görünürlük kuralı sunucuda uygulanır. */
  app.get("/api/aricimap/locations", requireUser, async (req: AuthedRequest, res) => {
    res.json({ locations: await locationsVisibleTo(req.user!) });
  });

  // --- Personel yetki başvuruları -----------------------------------------

  /** Arıcı, kurum bilgileriyle personel yetkisi için başvurur. */
  app.post("/api/aricimap/staff-applications", requireUser, async (req: AuthedRequest, res) => {
    const applicantName = asText(req.body?.applicantName) || req.user!.name;
    const institution = asText(req.body?.institution);
    const title = asText(req.body?.title);
    const institutionEmail = asText(req.body?.institutionEmail);
    if (institution.length < 3 || title.length < 2) {
      res.status(400).json({ error: "Kurum adı ve unvan zorunludur." });
      return;
    }
    if (!looksLikeEmail(institutionEmail)) {
      res.status(400).json({ error: "Geçerli bir kurum e-postası girin." });
      return;
    }
    const result = await submitApplication({
      userId: req.user!.id,
      applicantName,
      institution,
      title,
      institutionEmail,
      province: asText(req.body?.province) || null,
      district: asText(req.body?.district) || null,
    });
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json({ application: result.application });
  });

  app.get("/api/aricimap/staff-applications", requireUser, requireAdmin, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ applications: await listApplications(status as never) });
  });

  app.post("/api/aricimap/staff-applications/:id/decide", requireUser, requireAdmin, async (req, res) => {
    const onayIl = asText(req.body?.province);
    const onayIlce = asText(req.body?.district);
    if (req.body?.approve === true) {
      if (!onayIl || !onayIlce) {
        res.status(400).json({ error: "Onaylamadan önce il ve ilçe seçin." });
        return;
      }
      if (!ilceVarMi(onayIl, onayIlce)) {
        res.status(400).json({ error: "Seçilen ilçe bu ile ait değil." });
        return;
      }
    }
    const result = await decideApplication(req.params.id, req.body?.approve === true, {
      province: onayIl || null,
      district: onayIlce || null,
      note: asText(req.body?.note),
    });
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ application: result.application });
  });

  // --- Saha tespiti --------------------------------------------------------

  /** Personelin sorumlu olduğu bölgedeki konumlar, tespit durumuyla birlikte. */
  app.get("/api/aricimap/fieldwork/locations", requireUser, requireField, async (req: AuthedRequest, res) => {
    const filter = typeof req.query.filter === "string" ? req.query.filter : "hepsi";
    const allowed = ["hepsi", "tespit_edilen", "tespit_edilmeyen"];
    res.json({
      locations: await locationsForFieldwork(
        req.user! as never,
        (allowed.includes(filter) ? filter : "hepsi") as never,
      ),
    });
  });

  app.get("/api/aricimap/fieldwork/locations/:id/visits", requireUser, requireField, async (req: AuthedRequest, res) => {
    if (!(await canWorkOnLocation(req.user! as never, req.params.id))) {
      res.status(403).json({ error: "Bu konum sorumlu olduğun bölgede değil." });
      return;
    }
    res.json({ visits: await visitsForLocation(req.params.id) });
  });

  /** "Gidildi" işareti, sayım ve not. Haritadaki renk bundan türer. */
  app.post("/api/aricimap/fieldwork/locations/:id/visit", requireUser, requireField, async (req: AuthedRequest, res) => {
    if (!(await canWorkOnLocation(req.user! as never, req.params.id))) {
      res.status(403).json({ error: "Bu konum sorumlu olduğun bölgede değil." });
      return;
    }
    const status = req.body?.status === "gidilmedi" ? "gidilmedi" : "gidildi";
    const raw = req.body?.hiveCount;
    const hiveCount = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (hiveCount !== null && (!Number.isInteger(hiveCount) || hiveCount < 0)) {
      res.status(400).json({ error: "Kovan sayısı 0 veya daha büyük bir tam sayı olmalı." });
      return;
    }
    const result = await recordVisit(req.user!.id, req.params.id, {
      status,
      hiveCount,
      note: asText(req.body?.note),
    });
    if ("error" in result) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.status(201).json({ visit: result.visit });
  });

  // --- Not defteri (kişiye özel) -------------------------------------------

  app.get("/api/aricimap/notebook", requireUser, requireField, async (req: AuthedRequest, res) => {
    res.json({ notes: await listNotes(req.user!.id) });
  });

  app.post("/api/aricimap/notebook", requireUser, requireField, async (req: AuthedRequest, res) => {
    const title = asText(req.body?.title);
    const body = asText(req.body?.body);
    if (!title && !body) {
      res.status(400).json({ error: "Başlık veya içerik gerekli." });
      return;
    }
    res.status(201).json({
      note: await addNote(req.user!.id, {
        title,
        body,
        district: asText(req.body?.district) || null,
        locationId: asText(req.body?.locationId) || null,
      }),
    });
  });

  app.patch("/api/aricimap/notebook/:id", requireUser, requireField, async (req: AuthedRequest, res) => {
    const result = await updateNote(req.user!.id, req.params.id, {
      title: typeof req.body?.title === "string" ? req.body.title : undefined,
      body: typeof req.body?.body === "string" ? req.body.body : undefined,
    });
    if ("error" in result) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ note: result.note });
  });

  app.delete("/api/aricimap/notebook/:id", requireUser, requireField, async (req: AuthedRequest, res) => {
    const removed = await deleteNote(req.user!.id, req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Not bulunamadı." });
      return;
    }
    res.json({ ok: true });
  });

  // --- Duyurular (herkese açık) --------------------------------------------

  app.get("/api/aricimap/announcements", requireUser, async (req: AuthedRequest, res) => {
    // Yönetici bütün duyuruları (pasifler dahil) yönetim için görür.
    // Diğerleri yalnızca kendi bölgelerini ilgilendiren yayındaki duyuruları.
    if (req.user!.role === "yonetici") {
      res.json({ announcements: await listAnnouncements(false) });
      return;
    }
    res.json({
      announcements: await announcementsFor({
        province: req.user!.province,
        district: req.user!.district,
      }),
    });
  });

  app.post("/api/aricimap/announcements", requireUser, requireAdmin, async (req, res) => {
    const title = asText(req.body?.title);
    if (title.length < 3) {
      res.status(400).json({ error: "Duyuru başlığı en az 3 karakter olmalı." });
      return;
    }
    res.status(201).json({
      announcement: await createAnnouncement({
        title,
        body: asText(req.body?.body),
        level: req.body?.level,
        // Boş bırakılırsa duyuru Türkiye geneline yayınlanır.
        province: asText(req.body?.province) || null,
        district: asText(req.body?.district) || null,
      }),
    });
  });

  app.patch("/api/aricimap/announcements/:id", requireUser, requireAdmin, async (req, res) => {
    const result = await setAnnouncementActive(req.params.id, req.body?.active !== false);
    if ("error" in result) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ announcement: result.announcement });
  });

  app.delete("/api/aricimap/announcements/:id", requireUser, requireAdmin, async (req, res) => {
    const removed = await deleteAnnouncement(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Duyuru bulunamadı." });
      return;
    }
    res.json({ ok: true });
  });

  // --- Reklam panosu -------------------------------------------------------

  /** Panoda gösterilecek reklam. Gösterim sayacı burada artar. */
  app.get("/api/aricimap/sponsor", requireUser, async (_req, res) => {
    res.json({ ad: await activeAd() });
  });

  app.post("/api/aricimap/sponsor/:id/click", requireUser, async (req, res) => {
    await countClick(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/aricimap/ads", requireUser, requireAdmin, async (_req, res) => {
    res.json({ ads: await listAds() });
  });

  app.post("/api/aricimap/ads", requireUser, requireAdmin, async (req, res) => {
    const company = asText(req.body?.company);
    if (company.length < 2) {
      res.status(400).json({ error: "Firma adı zorunludur." });
      return;
    }
    res.status(201).json({
      ad: await saveAd({
        id: asText(req.body?.id) || null,
        company,
        title: asText(req.body?.title),
        description: asText(req.body?.description),
        cta: asText(req.body?.cta),
        website: asText(req.body?.website),
        phone: asText(req.body?.phone),
        whatsapp: asText(req.body?.whatsapp),
        imageUrl: asText(req.body?.imageUrl),
        videoUrl: asText(req.body?.videoUrl),
        status: req.body?.status === "paused" ? "paused" : "active",
        startsOn: asText(req.body?.startsOn) || null,
        endsOn: asText(req.body?.endsOn) || null,
      }),
    });
  });

  app.delete("/api/aricimap/ads/:id", requireUser, requireAdmin, async (req, res) => {
    const removed = await deleteAd(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Reklam bulunamadı." });
      return;
    }
    res.json({ ok: true });
  });

  // --- Konaklama talepleri -------------------------------------------------

  app.get("/api/aricimap/stay-requests", requireUser, async (req: AuthedRequest, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ requests: await listStayRequests(req.user! as never, status as never) });
  });

  app.post("/api/aricimap/stay-requests", requireUser, async (req: AuthedRequest, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: "Geçerli bir konum gerekli." });
      return;
    }
    const raw = req.body?.hives;
    const hives = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (hives !== null && (!Number.isInteger(hives) || hives < 0)) {
      res.status(400).json({ error: "Kovan sayısı 0 veya daha büyük bir tam sayı olmalı." });
      return;
    }
    const stayProvince = asText(req.body?.province);
    const stayDistrict = asText(req.body?.district);
    if (stayDistrict && !ilceVarMi(stayProvince, stayDistrict)) {
      res.status(400).json({ error: "Seçilen ilçe bu ile ait değil." });
      return;
    }
    const result = await createStayRequest(req.user!, {
      lat,
      lng,
      hives,
      fromDate: asText(req.body?.fromDate) || null,
      toDate: asText(req.body?.toDate) || null,
      note: asText(req.body?.note),
      province: stayProvince || null,
      district: stayDistrict || null,
    });
    res.status(201).json({ request: result.request });
  });

  app.post("/api/aricimap/stay-requests/:id/decide", requireUser, requireField, async (req: AuthedRequest, res) => {
    const status = req.body?.status === "yer_ayrildi" ? "yer_ayrildi" : "yer_yok";
    const result = await decideStayRequest(
      req.user! as never,
      req.params.id,
      status,
      asText(req.body?.decisionNote),
    );
    if ("error" in result) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json({ request: result.request });
  });

  // --- Parola yönetimi ------------------------------------------------------

  /** Kurtarma yolunun açık olup olmadığını istemci bilsin. */
  app.get("/api/aricimap/recovery-status", (_req, res) => {
    res.json({ enabled: recoveryEnabled() });
  });

  /** Kullanıcı kendi parolasını değiştirir. */
  app.post("/api/aricimap/me/password", requireUser, async (req: AuthedRequest, res) => {
    const result = await changeOwnPassword(
      req.user!,
      asText(req.body?.current),
      asText(req.body?.next),
    );
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    // Parola değişince eski oturumlar kapanır; istemci yeniden giriş yapmalı.
    res.json({ ok: true });
  });

  /** Yönetici, bir kullanıcının parolasını sıfırlar. */
  app.post("/api/aricimap/users/:id/password", requireUser, requireAdmin, async (req, res) => {
    const result = await adminResetPassword(req.params.id, asText(req.body?.next));
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  /**
   * Kurtarma anahtarıyla parola sıfırlama. Oturum gerektirmez: zaten giriş
   * yapamayan kişi için vardır. Anahtar yalnızca barındırma panelinden görülür.
   */
  app.post("/api/aricimap/recover", async (req, res) => {
    const result = await recoverWithKey(
      asText(req.body?.recoveryKey),
      asText(req.body?.phone),
      asText(req.body?.next),
    );
    if ("error" in result) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json({ ok: true, name: result.name, role: result.role });
  });

  /** Son çare: yönetici hesabı kalmadıysa bir hesabı yöneticiye yükseltir. */
  app.post("/api/aricimap/recover/promote", async (req, res) => {
    const result = await promoteWithKey(asText(req.body?.recoveryKey), asText(req.body?.phone));
    if ("error" in result) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json({ ok: true, name: result.name });
  });

  /** Yönetici sayısı sıfırsa sistem yönetilemez; yönetici bunu görebilmeli. */
  app.get("/api/aricimap/admin-count", requireUser, requireAdmin, async (_req, res) => {
    res.json({ count: await adminCount() });
  });
}
