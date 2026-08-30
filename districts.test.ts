import { describe, it, expect, beforeEach } from "vitest";

/**
 * İlçe sınırı ve bildirim yönlendirmesi testleri.
 *
 * Poligonlar kasıtlı olarak sentetiktir: "L" biçimli bir ilçe, onun iç
 * köşesine oturan dikdörtgen bir komşu. Bu ikisinin sınır kutuları çakışır,
 * yani sadece dikdörtgen kontrolü yapan bir kod bu testi geçemez.
 */
async function fresh() {
  const accounts = await import("./accountStore");
  const districts = await import("./districts");
  const notifications = await import("./notifications");
  await accounts.resetForTests();
  await districts.initDistrictSchema();
  await notifications.initNotificationSchema();
  await accounts.pool.query("TRUNCATE districts CASCADE");
  districts.clearDistrictCache();
  return { accounts, districts, notifications };
}

// "L" biçimli ilçe: sol alt köşede büyük bir boşluk bırakır.
const L_SEKLINDE = [
  [
    [40.0, 38.0],
    [41.0, 38.0],
    [41.0, 39.0],
    [40.6, 39.0],
    [40.6, 38.4],
    [40.0, 38.4],
    [40.0, 38.0],
  ],
];

// Komşu ilçe: tam olarak L'nin boşluğuna oturur.
const BOSLUKTAKI = [
  [
    [40.0, 38.4],
    [40.6, 38.4],
    [40.6, 39.0],
    [40.0, 39.0],
    [40.0, 38.4],
  ],
];

describe("ilçe sınırı hesabı", () => {
  let ctx: Awaited<ReturnType<typeof fresh>>;

  beforeEach(async () => {
    ctx = await fresh();
    await ctx.districts.saveDistrict("Diyarbakır", "Ellice", L_SEKLINDE);
    await ctx.districts.saveDistrict("Diyarbakır", "Bosluk", BOSLUKTAKI);
    ctx.districts.clearDistrictCache();
  });

  it("iki ilçenin sınır kutuları gerçekten çakışıyor", async () => {
    const all = await ctx.districts.loadDistricts(true);
    const l = all.find((d) => d.name === "Ellice")!;
    const b = all.find((d) => d.name === "Bosluk")!;
    // Kutular çakışmasaydı test bir şey kanıtlamazdı.
    const overlaps = l.minLng < b.maxLng && l.maxLng > b.minLng && l.minLat < b.maxLat && l.maxLat > b.minLat;
    expect(overlaps).toBe(true);
  });

  it("L'nin boşluğundaki nokta komşu ilçeye atanır, L'ye değil", async () => {
    // Bu nokta her iki ilçenin de sınır kutusunun içinde.
    const found = await ctx.districts.districtForPoint(38.7, 40.3);
    expect(found?.name).toBe("Bosluk");
  });

  it("L'nin gövdesindeki nokta doğru ilçeye atanır", async () => {
    const found = await ctx.districts.districtForPoint(38.2, 40.3);
    expect(found?.name).toBe("Ellice");
  });

  it("hiçbir ilçeye düşmeyen nokta için null döner", async () => {
    const found = await ctx.districts.districtForPoint(41.9, 44.0);
    expect(found).toBeNull();
  });

  it("dağınık sınır parçaları tek bir halkaya birleştirilir", () => {
    const relation = {
      id: 1,
      tags: { name: "Parcali", admin_level: "6" },
      members: [
        { type: "way", role: "outer", geometry: [
          { lat: 38.0, lon: 40.0 }, { lat: 38.0, lon: 41.0 },
        ] },
        { type: "way", role: "outer", geometry: [
          { lat: 39.0, lon: 41.0 }, { lat: 38.0, lon: 41.0 },
        ] },
        { type: "way", role: "outer", geometry: [
          { lat: 39.0, lon: 41.0 }, { lat: 39.0, lon: 40.0 }, { lat: 38.0, lon: 40.0 },
        ] },
      ],
    };
    const rings = ctx.districts.ringsFromRelation(relation);
    expect(rings).toHaveLength(1);
    expect(rings[0].length).toBeGreaterThan(3);
    // Birleşmiş halka gerçekten kapalı bir alan oluşturmalı.
    expect(ctx.districts.pointInRing(40.5, 38.5, rings[0])).toBe(true);
  });
});

describe("bildirim yönlendirmesi", () => {
  let ctx: Awaited<ReturnType<typeof fresh>>;
  let yonetici: string;
  let kulpPersoneli: string;
  let licePersoneli: string;
  let atanmamisPersonel: string;
  let arici: string;

  beforeEach(async () => {
    ctx = await fresh();
    await ctx.districts.saveDistrict("Diyarbakır", "Ellice", L_SEKLINDE);
    await ctx.districts.saveDistrict("Diyarbakır", "Bosluk", BOSLUKTAKI);
    ctx.districts.clearDistrictCache();

    const mk = async (name: string, phone: string) => {
      const r = await ctx.accounts.registerUser(name, phone, "parola123");
      if (!("user" in r)) throw new Error("kayıt başarısız");
      return r.user.id;
    };
    yonetici = await mk("Yonetici", "05550000001");
    kulpPersoneli = await mk("Ellice Personeli", "05550000002");
    licePersoneli = await mk("Bosluk Personeli", "05550000003");
    atanmamisPersonel = await mk("Atanmamis Personel", "05550000004");
    arici = await mk("Arici", "05550000005");

    await ctx.accounts.decideUser(kulpPersoneli, true, true);
    await ctx.accounts.decideUser(licePersoneli, true, true);
    await ctx.accounts.decideUser(atanmamisPersonel, true, true);
    await ctx.accounts.decideUser(arici, true, false);

    await ctx.notifications.assignArea(kulpPersoneli, "Diyarbakır", "Ellice");
    await ctx.notifications.assignArea(licePersoneli, "Diyarbakır", "Bosluk");
  });

  it("bildirim yalnızca olayın gerçekleştiği ilçenin personeline gider", async () => {
    // Ellice sınırları içinde bir konum paylaşımı.
    const result = await ctx.notifications.notifyArea({
      kind: "konum",
      title: "Yeni konum paylaşıldı",
      lat: 38.2,
      lng: 40.3,
      actorId: arici,
    });
    expect(result.district).toBe("Ellice");

    expect(await ctx.notifications.unreadCount(kulpPersoneli)).toBe(1);
    expect(await ctx.notifications.unreadCount(licePersoneli)).toBe(0);
    expect(await ctx.notifications.unreadCount(atanmamisPersonel)).toBe(0);
  });

  it("yönetici ilçe fark etmeksizin her bildirimi alır", async () => {
    await ctx.notifications.notifyArea({ kind: "konum", title: "A", lat: 38.2, lng: 40.3, actorId: arici });
    await ctx.notifications.notifyArea({ kind: "konaklama", title: "B", lat: 38.7, lng: 40.3, actorId: arici });
    expect(await ctx.notifications.unreadCount(yonetici)).toBe(2);
  });

  it("komşu ilçedeki olay diğer ilçenin personeline gitmez", async () => {
    await ctx.notifications.notifyArea({
      kind: "konaklama",
      title: "Konaklama talebi",
      lat: 38.7,
      lng: 40.3,
      actorId: arici,
    });
    expect(await ctx.notifications.unreadCount(licePersoneli)).toBe(1);
    expect(await ctx.notifications.unreadCount(kulpPersoneli)).toBe(0);
  });

  it("olayı üreten kişiye kendi bildirimi gönderilmez", async () => {
    await ctx.notifications.assignArea(kulpPersoneli, "Diyarbakır", "Ellice");
    await ctx.notifications.notifyArea({
      kind: "konum",
      title: "Kendi paylaşımı",
      lat: 38.2,
      lng: 40.3,
      actorId: kulpPersoneli,
    });
    expect(await ctx.notifications.unreadCount(kulpPersoneli)).toBe(0);
  });

  it("sıradan arıcı başkalarının hareketliliğinden haberdar olmaz", async () => {
    await ctx.notifications.notifyArea({ kind: "konum", title: "A", lat: 38.2, lng: 40.3 });
    expect(await ctx.notifications.unreadCount(arici)).toBe(0);
  });

  it("onay bekleyen personel bildirim almaz", async () => {
    const r = await ctx.accounts.registerUser("Bekleyen", "05550000009", "parola123");
    if (!("user" in r)) throw new Error("kayıt başarısız");
    await ctx.notifications.assignArea(r.user.id, "Diyarbakır", "Ellice");
    await ctx.notifications.notifyArea({ kind: "konum", title: "A", lat: 38.2, lng: 40.3 });
    expect(await ctx.notifications.unreadCount(r.user.id)).toBe(0);
  });

  it("okundu işaretlenen bildirim sayaçtan düşer", async () => {
    await ctx.notifications.notifyArea({ kind: "konum", title: "A", lat: 38.2, lng: 40.3, actorId: arici });
    const list = await ctx.notifications.listNotifications(kulpPersoneli);
    expect(list).toHaveLength(1);
    expect(list[0].district).toBe("Ellice");
    await ctx.notifications.markRead(kulpPersoneli, [list[0].id]);
    expect(await ctx.notifications.unreadCount(kulpPersoneli)).toBe(0);
  });
});
