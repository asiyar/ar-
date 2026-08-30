import { describe, it, expect, beforeEach } from "vitest";

const KUZEY = [
  [
    [40.0, 38.5],
    [41.0, 38.5],
    [41.0, 39.0],
    [40.0, 39.0],
    [40.0, 38.5],
  ],
];
const GUNEY = [
  [
    [40.0, 38.0],
    [41.0, 38.0],
    [41.0, 38.5],
    [40.0, 38.5],
    [40.0, 38.0],
  ],
];

async function fresh() {
  const accounts = await import("./accountStore");
  const districts = await import("./districts");
  const notifications = await import("./notifications");
  const applications = await import("./staffApplications");
  const fieldwork = await import("./fieldwork");

  await accounts.resetForTests();
  await districts.initDistrictSchema();
  await notifications.initNotificationSchema();
  await applications.initApplicationSchema();
  await fieldwork.initFieldworkSchema();
  await accounts.pool.query("TRUNCATE districts CASCADE");
  districts.clearDistrictCache();
  await districts.saveDistrict("Diyarbakır", "Kuzey", KUZEY);
  await districts.saveDistrict("Diyarbakır", "Guney", GUNEY);
  districts.clearDistrictCache();

  return { accounts, districts, notifications, applications, fieldwork };
}

async function makeUser(ctx: Awaited<ReturnType<typeof fresh>>, name: string, phone: string) {
  const r = await ctx.accounts.registerUser(name, phone, "parola123");
  if (!("user" in r)) throw new Error("kayıt başarısız: " + r.error);
  return r.user;
}

/**
 * Kullanıcıyı, uygulamanın gerçekte kullandığı yoldan tazeler: oturum jetonu
 * çözümlemesi. Elle SQL okunursa, district alanının oturum nesnesine taşınıp
 * taşınmadığı test edilmemiş olur.
 */
async function reload(ctx: Awaited<ReturnType<typeof fresh>>, id: string) {
  const token = await ctx.accounts.createSession(id);
  const user = await ctx.accounts.userForToken(token);
  if (!user) throw new Error("kullanıcı çözümlenemedi");
  return user;
}

describe("arıcı kaydı ve personel başvurusu", () => {
  let ctx: Awaited<ReturnType<typeof fresh>>;

  beforeEach(async () => {
    ctx = await fresh();
  });

  it("arıcı kayıt olur olmaz onaylıdır, onay beklemez", async () => {
    await makeUser(ctx, "Yonetici", "05550000001");
    const arici = await makeUser(ctx, "Murat Tekin", "05550000002");
    expect(arici.role).toBe("arici");
    expect(arici.status).toBe("onayli");
  });

  it("personel yetkisi başvuru olmadan verilmez", async () => {
    await makeUser(ctx, "Yonetici", "05550000001");
    const aday = await makeUser(ctx, "Aday", "05550000002");
    const fresh1 = await reload(ctx, aday.id);
    expect(fresh1.role).toBe("arici");
    expect(fresh1.staffCode).toBeNull();
  });

  it("kurum bilgileriyle başvuru kaydedilir", async () => {
    await makeUser(ctx, "Yonetici", "05550000001");
    const aday = await makeUser(ctx, "Aday", "05550000002");
    const result = await ctx.applications.submitApplication({
      userId: aday.id,
      applicantName: "Ayşe Yılmaz",
      institution: "Diyarbakır İl Tarım ve Orman Müdürlüğü",
      title: "Veteriner Hekim",
      institutionEmail: "ayse.yilmaz@tarimorman.gov.tr",
      district: "Kuzey",
    });
    expect("application" in result).toBe(true);
    const pending = await ctx.applications.listApplications("beklemede");
    expect(pending).toHaveLength(1);
    expect(pending[0].institution).toContain("Tarım");
  });

  it("aynı kişi ikinci kez bekleyen başvuru açamaz", async () => {
    await makeUser(ctx, "Yonetici", "05550000001");
    const aday = await makeUser(ctx, "Aday", "05550000002");
    const base = {
      userId: aday.id,
      applicantName: "Ayşe",
      institution: "Kurum",
      title: "Unvan",
      institutionEmail: "a@b.gov.tr",
    };
    await ctx.applications.submitApplication(base);
    const again = await ctx.applications.submitApplication(base);
    expect("error" in again).toBe(true);
  });

  it("onaylanan başvuru personel kodu ve ilçe ataması üretir", async () => {
    await makeUser(ctx, "Yonetici", "05550000001");
    const aday = await makeUser(ctx, "Aday", "05550000002");
    const created = await ctx.applications.submitApplication({
      userId: aday.id,
      applicantName: "Ayşe",
      institution: "Kurum",
      title: "Unvan",
      institutionEmail: "a@b.gov.tr",
      district: "Kuzey",
    });
    if (!("application" in created)) throw new Error("başvuru oluşmadı");

    const decided = await ctx.applications.decideApplication(created.application.id, true, {
      province: "Diyarbakır",
      district: "Kuzey",
    });
    expect("application" in decided).toBe(true);

    const updated = await reload(ctx, aday.id);
    expect(updated.role).toBe("personel");
    expect(updated.staffCode).toBe("P-001");
    expect(updated.district).toBe("Kuzey");
  });

  it("reddedilen başvuru yetki vermez", async () => {
    await makeUser(ctx, "Yonetici", "05550000001");
    const aday = await makeUser(ctx, "Aday", "05550000002");
    const created = await ctx.applications.submitApplication({
      userId: aday.id,
      applicantName: "Ayşe",
      institution: "Kurum",
      title: "Unvan",
      institutionEmail: "a@b.gov.tr",
    });
    if (!("application" in created)) throw new Error("başvuru oluşmadı");
    await ctx.applications.decideApplication(created.application.id, false, { note: "Belge eksik" });
    const updated = await reload(ctx, aday.id);
    expect(updated.role).toBe("arici");
  });

  it("aynı başvuru iki kez karara bağlanamaz", async () => {
    await makeUser(ctx, "Yonetici", "05550000001");
    const aday = await makeUser(ctx, "Aday", "05550000002");
    const created = await ctx.applications.submitApplication({
      userId: aday.id,
      applicantName: "Ayşe",
      institution: "Kurum",
      title: "Unvan",
      institutionEmail: "a@b.gov.tr",
    });
    if (!("application" in created)) throw new Error("başvuru oluşmadı");
    await ctx.applications.decideApplication(created.application.id, true, { district: "Kuzey" });
    const again = await ctx.applications.decideApplication(created.application.id, true, {});
    expect("error" in again).toBe(true);
  });

  it("kurum e-postası biçimi elenir", () => {
    expect(ctx.applications.looksLikeEmail("ayse@tarimorman.gov.tr")).toBe(true);
    expect(ctx.applications.looksLikeEmail("ayse-at-kurum")).toBe(false);
    expect(ctx.applications.looksLikeEmail("")).toBe(false);
  });
});

describe("saha tespiti ve not defteri", () => {
  let ctx: Awaited<ReturnType<typeof fresh>>;
  let yonetici: string;
  let kuzeyPersoneli: string;
  let guneyPersoneli: string;
  let muratKonumu: string;
  let guneyKonumu: string;

  beforeEach(async () => {
    ctx = await fresh();
    const admin = await makeUser(ctx, "Yonetici", "05550000001");
    yonetici = admin.id;

    const p1 = await makeUser(ctx, "Kuzey Personeli", "05550000002");
    const p2 = await makeUser(ctx, "Guney Personeli", "05550000003");
    kuzeyPersoneli = p1.id;
    guneyPersoneli = p2.id;
    for (const [id, ilce] of [
      [kuzeyPersoneli, "Kuzey"],
      [guneyPersoneli, "Guney"],
    ] as const) {
      const app = await ctx.applications.submitApplication({
        userId: id,
        applicantName: "Personel",
        institution: "Kurum",
        title: "Unvan",
        institutionEmail: "p@b.gov.tr",
        district: ilce,
      });
      if (!("application" in app)) throw new Error("başvuru oluşmadı");
      await ctx.applications.decideApplication(app.application.id, true, {
        province: "Diyarbakır",
        district: ilce,
      });
    }

    const murat = await makeUser(ctx, "Murat Tekin", "05550000004");
    const veli = await makeUser(ctx, "Veli", "05550000005");
    const l1 = await ctx.accounts.upsertLocation(murat.id, { lat: 38.7, lng: 40.5, hives: 520 });
    const l2 = await ctx.accounts.upsertLocation(veli.id, { lat: 38.2, lng: 40.5, hives: 60 });
    muratKonumu = l1.id;
    guneyKonumu = l2.id;
  });

  it("personel yalnızca kendi ilçesindeki konumları görür", async () => {
    const kuzey = await ctx.fieldwork.locationsForFieldwork(await reload(ctx, kuzeyPersoneli));
    expect(kuzey).toHaveLength(1);
    expect(kuzey[0].ownerName).toBe("Murat Tekin");

    const guney = await ctx.fieldwork.locationsForFieldwork(await reload(ctx, guneyPersoneli));
    expect(guney).toHaveLength(1);
    expect(guney[0].ownerName).toBe("Veli");
  });

  it("yönetici bütün ilçelerdeki konumları görür", async () => {
    const hepsi = await ctx.fieldwork.locationsForFieldwork(await reload(ctx, yonetici));
    expect(hepsi).toHaveLength(2);
  });

  it("ziyaret öncesi konum tespit edilmemiş sayılır", async () => {
    const rows = await ctx.fieldwork.locationsForFieldwork(await reload(ctx, kuzeyPersoneli));
    expect(rows[0].inspected).toBe(false);
    expect(rows[0].lastVisit).toBeNull();
  });

  it("gidildi işaretlenince tespit edilmiş sayılır ve not saklanır", async () => {
    await ctx.fieldwork.recordVisit(kuzeyPersoneli, muratKonumu, {
      status: "gidildi",
      hiveCount: 520,
      note: "12.08.2026 tarihinde saydım",
    });
    const rows = await ctx.fieldwork.locationsForFieldwork(await reload(ctx, kuzeyPersoneli));
    expect(rows[0].inspected).toBe(true);
    expect(rows[0].lastVisit?.hiveCount).toBe(520);
    expect(rows[0].lastVisit?.note).toContain("saydım");
  });

  it("tespit edilen ve edilmeyen listeleri ayrışır", async () => {
    const admin = await reload(ctx, yonetici);
    await ctx.fieldwork.recordVisit(kuzeyPersoneli, muratKonumu, { status: "gidildi" });

    const edilen = await ctx.fieldwork.locationsForFieldwork(admin, "tespit_edilen");
    const edilmeyen = await ctx.fieldwork.locationsForFieldwork(admin, "tespit_edilmeyen");
    expect(edilen.map((r) => r.ownerName)).toEqual(["Murat Tekin"]);
    expect(edilmeyen.map((r) => r.ownerName)).toEqual(["Veli"]);
  });

  it("en son ziyaret geçerlidir, eski kayıt geçmişte kalır", async () => {
    await ctx.fieldwork.recordVisit(kuzeyPersoneli, muratKonumu, { status: "gidildi", hiveCount: 500 });
    await new Promise((r) => setTimeout(r, 15));
    await ctx.fieldwork.recordVisit(kuzeyPersoneli, muratKonumu, { status: "gidilmedi", note: "Taşınmış" });

    const rows = await ctx.fieldwork.locationsForFieldwork(await reload(ctx, kuzeyPersoneli));
    expect(rows[0].inspected).toBe(false);
    expect(rows[0].lastVisit?.note).toBe("Taşınmış");

    const gecmis = await ctx.fieldwork.visitsForLocation(muratKonumu);
    expect(gecmis).toHaveLength(2);
  });

  it("personel başka ilçedeki konuma müdahale edemez", async () => {
    const kuzey = await reload(ctx, kuzeyPersoneli);
    expect(await ctx.fieldwork.canWorkOnLocation(kuzey, guneyKonumu)).toBe(false);
    expect(await ctx.fieldwork.canWorkOnLocation(kuzey, muratKonumu)).toBe(true);
  });

  it("ilçesi atanmamış personel hiçbir konum görmez", async () => {
    const bos = await makeUser(ctx, "Atanmamis", "05550000006");
    await ctx.accounts.pool.query("UPDATE users SET role = 'personel' WHERE id = $1", [bos.id]);
    const rows = await ctx.fieldwork.locationsForFieldwork(await reload(ctx, bos.id));
    expect(rows).toHaveLength(0);
  });

  it("not defteri kaydedilir ve düzenlenebilir", async () => {
    const not = await ctx.fieldwork.addNote(kuzeyPersoneli, {
      title: "Kuzey turu",
      body: "3 arılık kaldı",
      district: "Kuzey",
    });
    const guncel = await ctx.fieldwork.updateNote(kuzeyPersoneli, not.id, { body: "2 arılık kaldı" });
    expect("note" in guncel && guncel.note.body).toBe("2 arılık kaldı");
  });

  it("not defteri kişiseldir, başka personel göremez ve değiştiremez", async () => {
    const not = await ctx.fieldwork.addNote(kuzeyPersoneli, { title: "Özel", body: "gizli" });

    const digerininDefteri = await ctx.fieldwork.listNotes(guneyPersoneli);
    expect(digerininDefteri).toHaveLength(0);

    const izinsizDuzenleme = await ctx.fieldwork.updateNote(guneyPersoneli, not.id, { body: "ele geçirdim" });
    expect("error" in izinsizDuzenleme).toBe(true);

    const izinsizSilme = await ctx.fieldwork.deleteNote(guneyPersoneli, not.id);
    expect(izinsizSilme).toBe(false);

    const kendiDefteri = await ctx.fieldwork.listNotes(kuzeyPersoneli);
    expect(kendiDefteri[0].body).toBe("gizli");
  });

  it("kendi notu silinebilir", async () => {
    const not = await ctx.fieldwork.addNote(kuzeyPersoneli, { title: "Gecici" });
    expect(await ctx.fieldwork.deleteNote(kuzeyPersoneli, not.id)).toBe(true);
    expect(await ctx.fieldwork.listNotes(kuzeyPersoneli)).toHaveLength(0);
  });
});
