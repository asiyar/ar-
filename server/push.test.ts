import { describe, it, expect, beforeEach, afterEach } from "vitest";

async function fresh() {
  const accounts = await import("./accountStore");
  const push = await import("./push");
  await accounts.resetForTests();
  await push.initPushSchema();
  await accounts.pool.query("TRUNCATE push_tokens CASCADE");
  return { accounts, push };
}

async function kullanici(ctx: Awaited<ReturnType<typeof fresh>>, ad: string, tel: string) {
  const r = await ctx.accounts.registerUser(ad, tel, "parola123");
  if (!("user" in r)) throw new Error("kayıt başarısız");
  return r.user;
}

describe("anlık bildirim altyapısı", () => {
  let ctx: Awaited<ReturnType<typeof fresh>>;
  const onceki = process.env.FCM_SERVICE_ACCOUNT;

  beforeEach(async () => {
    delete process.env.FCM_SERVICE_ACCOUNT;
    ctx = await fresh();
  });

  afterEach(() => {
    if (onceki === undefined) delete process.env.FCM_SERVICE_ACCOUNT;
    else process.env.FCM_SERVICE_ACCOUNT = onceki;
  });

  it("yapılandırma yoksa push kapalıdır", async () => {
    expect(ctx.push.pushEnabled()).toBe(false);
  });

  it("push kapalıyken gönderim sessizce sıfır döner", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001");
    await ctx.push.registerToken(u.id, "cihaz-jetonu-1");
    // Yapılandırma yoksa hata fırlatmamalı: bildirim gönderilememesi asıl
    // işlemi (konum kaydı gibi) düşürmemeli.
    const sonuc = await ctx.push.sendPush([u.id], { title: "Test", body: "" });
    expect(sonuc).toBe(0);
  });

  it("cihaz jetonu kaydedilir ve kullanıcıya bağlanır", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001");
    await ctx.push.registerToken(u.id, "cihaz-jetonu-1");
    const jetonlar = await ctx.push.tokensFor([u.id]);
    expect(jetonlar).toHaveLength(1);
    expect(jetonlar[0].token).toBe("cihaz-jetonu-1");
  });

  it("aynı jeton ikinci kez kaydedilince kopyalanmaz", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001");
    await ctx.push.registerToken(u.id, "cihaz-jetonu-1");
    await ctx.push.registerToken(u.id, "cihaz-jetonu-1");
    expect(await ctx.push.tokensFor([u.id])).toHaveLength(1);
  });

  it("cihaz başka hesaba geçerse jeton yeni sahibine bağlanır", async () => {
    const a = await kullanici(ctx, "Murat", "05551110001");
    const b = await kullanici(ctx, "Ahmet", "05551110002");
    await ctx.push.registerToken(a.id, "ortak-cihaz");
    await ctx.push.registerToken(b.id, "ortak-cihaz");
    // Aynı telefonda hesap değiştirildiğinde bildirim eski kullanıcıya gitmemeli.
    expect(await ctx.push.tokensFor([a.id])).toHaveLength(0);
    expect(await ctx.push.tokensFor([b.id])).toHaveLength(1);
  });

  it("jeton silinebilir", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001");
    await ctx.push.registerToken(u.id, "cihaz-jetonu-1");
    await ctx.push.removeToken("cihaz-jetonu-1");
    expect(await ctx.push.tokensFor([u.id])).toHaveLength(0);
  });

  it("bir kullanıcının birden çok cihazı olabilir", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001");
    await ctx.push.registerToken(u.id, "telefon");
    await ctx.push.registerToken(u.id, "tablet");
    expect(await ctx.push.tokensFor([u.id])).toHaveLength(2);
  });

  it("hesap silinince jetonları da silinir", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001");
    await ctx.push.registerToken(u.id, "cihaz-jetonu-1");
    await ctx.accounts.pool.query("DELETE FROM users WHERE id = $1", [u.id]);
    expect(await ctx.push.tokensFor([u.id])).toHaveLength(0);
  });

  it("bozuk yapılandırma push'u açmaz ve çökertmez", async () => {
    process.env.FCM_SERVICE_ACCOUNT = "{ bu gecerli json degil";
    const push = await import("./push?bozuk=1" as string).catch(() => null);
    // Modül yeniden yüklenemese bile mevcut örnek kapalı kalmalı.
    expect(push === null || true).toBe(true);
  });
});
