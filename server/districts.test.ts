import { describe, it, expect, beforeEach } from "vitest";

/**
 * İlçe verisi ve bildirim yönlendirmesi.
 *
 * Önceki sürümde ilçe, koordinattan poligon aramasıyla bulunuyordu ve veri
 * OpenStreetMap'ten çekiliyordu. Barındırma ortamından o servise erişilemediği
 * için ilçe listesi hiç dolmuyordu; bu da personelin bir bölgeye atanamamasına
 * ve hiçbir bildirimin yönlendirilememesine yol açıyordu.
 *
 * Artık liste uygulamanın içinde gömülü, ilçe ise kullanıcının beyanı.
 */
async function fresh() {
  const accounts = await import("./accountStore");
  const notifications = await import("./notifications");
  await accounts.resetForTests();
  await notifications.initNotificationSchema();
  return { accounts, notifications };
}

describe("yerleşik il ve ilçe verisi", () => {
  it("81 il tanımlı", async () => {
    const { TR_ILLER } = await import("./trAdres");
    expect(TR_ILLER).toHaveLength(81);
  });

  it("il listesi ağ erişimi olmadan döner", async () => {
    const districts = await import("./districts");
    const iller = await districts.listProvinces();
    expect(iller).toHaveLength(81);
    expect(iller.every((x) => x.count > 0)).toBe(true);
  });

  it("bilinen ilçeler doğru ile bağlı", async () => {
    const { ilceVarMi } = await import("./trAdres");
    expect(ilceVarMi("Diyarbakır", "Kulp")).toBe(true);
    expect(ilceVarMi("Diyarbakır", "Lice")).toBe(true);
    expect(ilceVarMi("Muğla", "Bodrum")).toBe(true);
    // Başka ilin ilçesi kabul edilmemeli.
    expect(ilceVarMi("Muğla", "Kulp")).toBe(false);
    expect(ilceVarMi("YokBöyleİl", "Kulp")).toBe(false);
  });

  it("aynı adlı ilçeler farklı illerde bulunabilir", async () => {
    const { ilceVarMi } = await import("./trAdres");
    // "Merkez" pek çok ilde vardır; il bilgisi olmadan ilçe adı tek başına yetmez.
    expect(ilceVarMi("Bingöl", "Merkez")).toBe(true);
    expect(ilceVarMi("Tunceli", "Merkez")).toBe(true);
  });

  it("her ilin ilçe listesi boş değil", async () => {
    const { TR_ILLER, ilceler } = await import("./trAdres");
    const bos = TR_ILLER.filter((il) => ilceler(il).length === 0);
    expect(bos).toEqual([]);
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
    const mk = async (name: string, phone: string) => {
      const r = await ctx.accounts.registerUser(name, phone, "parola123");
      if (!("user" in r)) throw new Error("kayıt başarısız");
      return r.user.id;
    };
    yonetici = await mk("Yonetici", "05550000001");
    kulpPersoneli = await mk("Kulp Personeli", "05550000002");
    licePersoneli = await mk("Lice Personeli", "05550000003");
    atanmamisPersonel = await mk("Atanmamis", "05550000004");
    arici = await mk("Arici", "05550000005");

    for (const id of [kulpPersoneli, licePersoneli, atanmamisPersonel]) {
      await ctx.accounts.pool.query("UPDATE users SET role = 'personel' WHERE id = $1", [id]);
    }
    await ctx.notifications.assignArea(kulpPersoneli, "Diyarbakır", "Kulp");
    await ctx.notifications.assignArea(licePersoneli, "Diyarbakır", "Lice");
  });

  it("bildirim yalnızca beyan edilen ilçenin personeline gider", async () => {
    const sonuc = await ctx.notifications.notifyArea({
      kind: "konum",
      title: "Yeni konum paylaşıldı",
      lat: 38.2,
      lng: 40.3,
      province: "Diyarbakır",
      district: "Kulp",
      actorId: arici,
    });
    expect(sonuc.district).toBe("Kulp");
    expect(await ctx.notifications.unreadCount(kulpPersoneli)).toBe(1);
    expect(await ctx.notifications.unreadCount(licePersoneli)).toBe(0);
    expect(await ctx.notifications.unreadCount(atanmamisPersonel)).toBe(0);
  });

  it("komşu ilçedeki olay diğer ilçenin personeline gitmez", async () => {
    await ctx.notifications.notifyArea({
      kind: "konaklama",
      title: "Konaklama talebi",
      lat: 38.7,
      lng: 40.3,
      province: "Diyarbakır",
      district: "Lice",
      actorId: arici,
    });
    expect(await ctx.notifications.unreadCount(licePersoneli)).toBe(1);
    expect(await ctx.notifications.unreadCount(kulpPersoneli)).toBe(0);
  });

  it("yönetici ilçe fark etmeksizin her bildirimi alır", async () => {
    await ctx.notifications.notifyArea({ kind: "konum", title: "A", lat: 38.2, lng: 40.3, district: "Kulp", actorId: arici });
    await ctx.notifications.notifyArea({ kind: "konum", title: "B", lat: 38.7, lng: 40.3, district: "Lice", actorId: arici });
    expect(await ctx.notifications.unreadCount(yonetici)).toBe(2);
  });

  it("ilçe beyan edilmezse yalnızca yönetici bilgilendirilir", async () => {
    await ctx.notifications.notifyArea({ kind: "konum", title: "Bölgesiz", lat: 0, lng: 0, actorId: arici });
    expect(await ctx.notifications.unreadCount(yonetici)).toBe(1);
    expect(await ctx.notifications.unreadCount(kulpPersoneli)).toBe(0);
  });

  it("olayı üreten kişiye kendi bildirimi gönderilmez", async () => {
    await ctx.notifications.notifyArea({
      kind: "konum", title: "Kendi paylaşımı", lat: 38.2, lng: 40.3,
      district: "Kulp", actorId: kulpPersoneli,
    });
    expect(await ctx.notifications.unreadCount(kulpPersoneli)).toBe(0);
  });

  it("sıradan arıcı başkalarının hareketliliğinden haberdar olmaz", async () => {
    await ctx.notifications.notifyArea({ kind: "konum", title: "A", lat: 38.2, lng: 40.3, district: "Kulp" });
    expect(await ctx.notifications.unreadCount(arici)).toBe(0);
  });

  it("okundu işaretlenen bildirim sayaçtan düşer", async () => {
    await ctx.notifications.notifyArea({
      kind: "konum", title: "A", lat: 38.2, lng: 40.3, district: "Kulp", actorId: arici,
    });
    const liste = await ctx.notifications.listNotifications(kulpPersoneli);
    expect(liste).toHaveLength(1);
    expect(liste[0].district).toBe("Kulp");
    await ctx.notifications.markRead(kulpPersoneli, [liste[0].id]);
    expect(await ctx.notifications.unreadCount(kulpPersoneli)).toBe(0);
  });
});
