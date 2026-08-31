import { describe, it, expect, beforeEach } from "vitest";

async function fresh() {
  const accounts = await import("./accountStore");
  const notifications = await import("./notifications");
  const applications = await import("./staffApplications");
  const content = await import("./content");
  const stay = await import("./stayRequests");

  await accounts.resetForTests();
  await notifications.initNotificationSchema();
  await applications.initApplicationSchema();
  await content.initContentSchema();
  await stay.initStaySchema();
  await accounts.pool.query("TRUNCATE announcements, ads, stay_requests CASCADE");

  return { accounts, notifications, applications, content, stay };
}

async function user(ctx: Awaited<ReturnType<typeof fresh>>, name: string, phone: string) {
  const r = await ctx.accounts.registerUser(name, phone, "parola123");
  if (!("user" in r)) throw new Error("kayıt başarısız");
  const token = await ctx.accounts.createSession(r.user.id);
  return (await ctx.accounts.userForToken(token))!;
}

async function makeStaff(ctx: Awaited<ReturnType<typeof fresh>>, id: string, district: string) {
  const app = await ctx.applications.submitApplication({
    userId: id,
    applicantName: "Personel",
    institution: "Kurum",
    title: "Unvan",
    institutionEmail: "p@b.gov.tr",
    district,
  });
  if (!("application" in app)) throw new Error("başvuru oluşmadı");
  await ctx.applications.decideApplication(app.application.id, true, {
    province: "Diyarbakır",
    district,
  });
  const token = await ctx.accounts.createSession(id);
  return (await ctx.accounts.userForToken(token))!;
}

describe("duyurular", () => {
  let ctx: Awaited<ReturnType<typeof fresh>>;
  beforeEach(async () => {
    ctx = await fresh();
  });

  it("yayınlanan duyuru listelenir", async () => {
    await ctx.content.createAnnouncement({ title: "Bal ormanı ilanı", body: "Detaylar", level: "bilgi" });
    const list = await ctx.content.listAnnouncements(true);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Bal ormanı ilanı");
  });

  it("pasife alınan duyuru yayından kalkar ama kayıtta durur", async () => {
    const d = await ctx.content.createAnnouncement({ title: "Geçici" });
    await ctx.content.setAnnouncementActive(d.id, false);
    expect(await ctx.content.listAnnouncements(true)).toHaveLength(0);
    expect(await ctx.content.listAnnouncements(false)).toHaveLength(1);
  });

  it("bilinmeyen önem düzeyi bilgiye çekilir", async () => {
    const d = await ctx.content.createAnnouncement({ title: "X", level: "sacma" as never });
    expect(d.level).toBe("bilgi");
  });

  it("Türkiye geneli duyuru herkese gider", async () => {
    await ctx.content.createAnnouncement({ title: "Genel duyuru" });
    const diyarbakirli = await ctx.content.announcementsFor({ province: "Diyarbakır", district: "Kulp" });
    const ankarali = await ctx.content.announcementsFor({ province: "Ankara", district: null });
    const bolgesiz = await ctx.content.announcementsFor({});
    expect(diyarbakirli).toHaveLength(1);
    expect(ankarali).toHaveLength(1);
    expect(bolgesiz).toHaveLength(1);
  });

  it("il duyurusu yalnızca o ildekilere gider", async () => {
    await ctx.content.createAnnouncement({ title: "Diyarbakır duyurusu", province: "Diyarbakır" });
    expect(await ctx.content.announcementsFor({ province: "Diyarbakır" })).toHaveLength(1);
    expect(await ctx.content.announcementsFor({ province: "Ankara" })).toHaveLength(0);
    expect(await ctx.content.announcementsFor({})).toHaveLength(0);
  });

  it("ilçe duyurusu yalnızca o ilçedekilere gider", async () => {
    await ctx.content.createAnnouncement({
      title: "Kuzey duyurusu", province: "Diyarbakır", district: "Kulp",
    });
    expect(await ctx.content.announcementsFor({ province: "Diyarbakır", district: "Kulp" })).toHaveLength(1);
    expect(await ctx.content.announcementsFor({ province: "Diyarbakır", district: "Lice" })).toHaveLength(0);
    expect(await ctx.content.announcementsFor({ province: "Diyarbakır" })).toHaveLength(0);
  });

  it("il seçilmeden ilçe verilirse ilçe yok sayılır", async () => {
    const d = await ctx.content.createAnnouncement({ title: "X", district: "Kulp" });
    expect(d.province).toBeNull();
    expect(d.district).toBeNull();
  });



});

describe("reklam panosu", () => {
  let ctx: Awaited<ReturnType<typeof fresh>>;
  beforeEach(async () => {
    ctx = await fresh();
  });

  it("aktif reklam panoda gösterilir ve gösterim sayılır", async () => {
    await ctx.content.saveAd({ company: "Bal Ticaret", title: "Kovan malzemeleri" });
    const first = await ctx.content.activeAd();
    expect(first?.company).toBe("Bal Ticaret");
    const list = await ctx.content.listAds();
    expect(list[0].impressions).toBe(1);
  });

  it("duraklatılmış reklam gösterilmez", async () => {
    await ctx.content.saveAd({ company: "Pasif", status: "paused" });
    expect(await ctx.content.activeAd()).toBeNull();
  });

  it("süresi geçmiş reklam gösterilmez", async () => {
    await ctx.content.saveAd({ company: "Eski", endsOn: "2020-01-01" });
    expect(await ctx.content.activeAd()).toBeNull();
  });

  it("başlamamış reklam gösterilmez", async () => {
    await ctx.content.saveAd({ company: "Gelecek", startsOn: "2999-01-01" });
    expect(await ctx.content.activeAd()).toBeNull();
  });

  it("gösterim en az gösterilene doğru dengelenir", async () => {
    await ctx.content.saveAd({ company: "A" });
    await ctx.content.saveAd({ company: "B" });
    const gorulen = [];
    for (let i = 0; i < 4; i++) {
      const ad = await ctx.content.activeAd();
      gorulen.push(ad!.company);
    }
    // Tek bir reklam dört kez gösterilmemeli.
    expect(new Set(gorulen).size).toBe(2);
    expect(gorulen.filter((c) => c === "A")).toHaveLength(2);
  });

  it("javascript: bağlantısı reddedilir, http korunur", async () => {
    const kotu = await ctx.content.saveAd({
      company: "X",
      website: "javascript:alert(1)",
    });
    expect(kotu.website).toBe("");
    const iyi = await ctx.content.saveAd({ company: "Y", website: "https://ornek.com" });
    expect(iyi.website).toBe("https://ornek.com/");
  });

  it("düzenleme yeni kayıt oluşturmaz", async () => {
    const ad = await ctx.content.saveAd({ company: "İlk" });
    await ctx.content.saveAd({ id: ad.id, company: "Güncel" });
    const list = await ctx.content.listAds();
    expect(list).toHaveLength(1);
    expect(list[0].company).toBe("Güncel");
  });
});

describe("konaklama talepleri", () => {
  let ctx: Awaited<ReturnType<typeof fresh>>;
  let yonetici: Awaited<ReturnType<typeof user>>;
  let kuzeyPersoneli: Awaited<ReturnType<typeof user>>;
  let guneyPersoneli: Awaited<ReturnType<typeof user>>;
  let arici: Awaited<ReturnType<typeof user>>;
  let digerArici: Awaited<ReturnType<typeof user>>;

  beforeEach(async () => {
    ctx = await fresh();
    yonetici = await user(ctx, "Yonetici", "05550000001");
    const p1 = await user(ctx, "Kuzey Personeli", "05550000002");
    const p2 = await user(ctx, "Guney Personeli", "05550000003");
    kuzeyPersoneli = await makeStaff(ctx, p1.id, "Kulp");
    guneyPersoneli = await makeStaff(ctx, p2.id, "Lice");
    arici = await user(ctx, "Murat Tekin", "05550000004");
    digerArici = await user(ctx, "Veli", "05550000005");
  });

  it("talep ilçeye göre etiketlenir ve o ilçenin personeline bildirilir", async () => {
    const created = await ctx.stay.createStayRequest(arici, {
      lat: 38.7, lng: 40.5, hives: 120, fromDate: "2026-09-01",
      province: "Diyarbakır", district: "Kulp",
    });
    expect(created.request.district).toBe("Kulp");
    expect(await ctx.notifications.unreadCount(kuzeyPersoneli.id)).toBeGreaterThan(0);

    const guneyBildirim = (await ctx.notifications.listNotifications(guneyPersoneli.id)).filter(
      (n) => n.kind === "konaklama",
    );
    expect(guneyBildirim).toHaveLength(0);
  });

  it("arıcı yalnızca kendi taleplerini görür", async () => {
    await ctx.stay.createStayRequest(arici, { lat: 38.7, lng: 40.5, province: "Diyarbakır", district: "Kulp" });
    await ctx.stay.createStayRequest(digerArici, { lat: 38.7, lng: 40.6, province: "Diyarbakır", district: "Kulp" });

    const benim = await ctx.stay.listStayRequests(arici);
    expect(benim).toHaveLength(1);
    expect(benim[0].ownerName).toBe("Murat Tekin");
    // Arıcıya telefon bilgisi dönmez.
    expect(benim[0].ownerPhone).toBeNull();
  });

  it("personel yalnızca kendi ilçesindeki talepleri görür", async () => {
    await ctx.stay.createStayRequest(arici, { lat: 38.7, lng: 40.5, province: "Diyarbakır", district: "Kulp" });
    await ctx.stay.createStayRequest(digerArici, { lat: 38.2, lng: 40.5, province: "Diyarbakır", district: "Lice" });

    const kuzey = await ctx.stay.listStayRequests(kuzeyPersoneli);
    expect(kuzey).toHaveLength(1);
    expect(kuzey[0].district).toBe("Kulp");
    expect(kuzey[0].ownerPhone).toBe("05550000004");

    const guney = await ctx.stay.listStayRequests(guneyPersoneli);
    expect(guney).toHaveLength(1);
    expect(guney[0].district).toBe("Lice");
  });

  it("yönetici bütün talepleri görür", async () => {
    await ctx.stay.createStayRequest(arici, { lat: 38.7, lng: 40.5, province: "Diyarbakır", district: "Kulp" });
    await ctx.stay.createStayRequest(digerArici, { lat: 38.2, lng: 40.5, province: "Diyarbakır", district: "Lice" });
    expect(await ctx.stay.listStayRequests(yonetici)).toHaveLength(2);
  });

  it("personel kendi ilçesindeki talebi karara bağlar ve arıcı bilgilendirilir", async () => {
    const created = await ctx.stay.createStayRequest(arici, { lat: 38.7, lng: 40.5, province: "Diyarbakır", district: "Kulp" });
    const decided = await ctx.stay.decideStayRequest(
      kuzeyPersoneli,
      created.request.id,
      "yer_ayrildi",
      "Kuzey mevkiinde yer var",
    );
    expect("request" in decided && decided.request.status).toBe("yer_ayrildi");

    const ariciKutusu = await ctx.notifications.listNotifications(arici.id);
    expect(ariciKutusu.some((n) => /onayland/i.test(n.title))).toBe(true);
  });

  it("personel başka ilçedeki talebi karara bağlayamaz", async () => {
    const created = await ctx.stay.createStayRequest(arici, { lat: 38.7, lng: 40.5, province: "Diyarbakır", district: "Kulp" });
    const denied = await ctx.stay.decideStayRequest(guneyPersoneli, created.request.id, "yer_yok");
    expect("error" in denied).toBe(true);
  });

  it("arıcı kendi talebini karara bağlayamaz", async () => {
    const created = await ctx.stay.createStayRequest(arici, { lat: 38.7, lng: 40.5, province: "Diyarbakır", district: "Kulp" });
    const denied = await ctx.stay.decideStayRequest(arici, created.request.id, "yer_ayrildi");
    expect("error" in denied).toBe(true);
  });

  it("ilçesi atanmamış personel hiçbir talep görmez", async () => {
    const bos = await user(ctx, "Atanmamis", "05550000006");
    await ctx.accounts.pool.query("UPDATE users SET role = 'personel' WHERE id = $1", [bos.id]);
    const token = await ctx.accounts.createSession(bos.id);
    const taze = (await ctx.accounts.userForToken(token))!;
    await ctx.stay.createStayRequest(arici, { lat: 38.7, lng: 40.5, province: "Diyarbakır", district: "Kulp" });
    expect(await ctx.stay.listStayRequests(taze)).toHaveLength(0);
  });
});
