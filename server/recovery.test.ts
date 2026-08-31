import { describe, it, expect, beforeEach, afterEach } from "vitest";

const ANAHTAR = "kurtarma-anahtari-test-1234";

async function fresh() {
  const accounts = await import("./accountStore");
  const recovery = await import("./recovery");
  await accounts.resetForTests();
  return { accounts, recovery };
}

async function kullanici(
  ctx: Awaited<ReturnType<typeof fresh>>,
  ad: string,
  tel: string,
  parola = "parola123",
) {
  const r = await ctx.accounts.registerUser(ad, tel, parola);
  if (!("user" in r)) throw new Error("kayıt başarısız");
  return r.user;
}

async function taze(ctx: Awaited<ReturnType<typeof fresh>>, id: string) {
  const token = await ctx.accounts.createSession(id);
  const u = await ctx.accounts.userForToken(token);
  if (!u) throw new Error("kullanıcı çözümlenemedi");
  return u;
}

describe("parola kurtarma", () => {
  let ctx: Awaited<ReturnType<typeof fresh>>;
  const oncekiAnahtar = process.env.ARICIMAP_RECOVERY_KEY;

  beforeEach(async () => {
    process.env.ARICIMAP_RECOVERY_KEY = ANAHTAR;
    ctx = await fresh();
  });

  afterEach(() => {
    if (oncekiAnahtar === undefined) delete process.env.ARICIMAP_RECOVERY_KEY;
    else process.env.ARICIMAP_RECOVERY_KEY = oncekiAnahtar;
  });

  it("kullanıcı mevcut parolasını bilerek değiştirebilir", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001", "eskiparola");
    const sonuc = await ctx.recovery.changeOwnPassword(u, "eskiparola", "yeniparola");
    expect("ok" in sonuc).toBe(true);
    expect("error" in (await ctx.accounts.verifyLogin("05551110001", "eskiparola"))).toBe(true);
    expect("user" in (await ctx.accounts.verifyLogin("05551110001", "yeniparola"))).toBe(true);
  });

  it("yanlış mevcut parolayla değiştirilemez", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001", "eskiparola");
    const sonuc = await ctx.recovery.changeOwnPassword(u, "yanlis", "yeniparola");
    expect("error" in sonuc).toBe(true);
    expect("user" in (await ctx.accounts.verifyLogin("05551110001", "eskiparola"))).toBe(true);
  });

  it("çok kısa parola reddedilir", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001", "eskiparola");
    expect("error" in (await ctx.recovery.changeOwnPassword(u, "eskiparola", "abc"))).toBe(true);
  });

  it("parola değişince eski oturumlar kapanır", async () => {
    const u = await kullanici(ctx, "Murat", "05551110001", "eskiparola");
    const jeton = await ctx.accounts.createSession(u.id);
    expect(await ctx.accounts.userForToken(jeton)).not.toBeNull();
    await ctx.recovery.changeOwnPassword(u, "eskiparola", "yeniparola");
    // Çalınmış bir jeton parola değişimiyle geçersizleşmeli.
    expect(await ctx.accounts.userForToken(jeton)).toBeNull();
  });

  it("yönetici bir kullanıcının parolasını sıfırlayabilir", async () => {
    await kullanici(ctx, "Yonetici", "05551110001");
    const arici = await kullanici(ctx, "Arici", "05551110002", "unutulan");
    const sonuc = await ctx.recovery.adminResetPassword(arici.id, "yeniparola");
    expect("ok" in sonuc).toBe(true);
    expect("user" in (await ctx.accounts.verifyLogin("05551110002", "yeniparola"))).toBe(true);
  });

  it("kurtarma anahtarıyla yönetici parolası sıfırlanır", async () => {
    await kullanici(ctx, "Yonetici", "05551110001", "unutuldu");
    const sonuc = await ctx.recovery.recoverWithKey(ANAHTAR, "05551110001", "yeniparola");
    expect("ok" in sonuc).toBe(true);
    expect("user" in (await ctx.accounts.verifyLogin("05551110001", "yeniparola"))).toBe(true);
  });

  it("yanlış anahtarla sıfırlanamaz", async () => {
    await kullanici(ctx, "Yonetici", "05551110001", "unutuldu");
    const sonuc = await ctx.recovery.recoverWithKey("yanlis-anahtar", "05551110001", "yeniparola");
    expect("error" in sonuc).toBe(true);
    expect("user" in (await ctx.accounts.verifyLogin("05551110001", "unutuldu"))).toBe(true);
  });

  it("yanlış anahtar ve kayıtsız telefon AYNI hatayı verir", async () => {
    await kullanici(ctx, "Yonetici", "05551110001", "unutuldu");
    const a = await ctx.recovery.recoverWithKey("yanlis", "05551110001", "yeniparola");
    const b = await ctx.recovery.recoverWithKey(ANAHTAR, "05559998888", "yeniparola");
    // Hata mesajları ayrışsaydı, bu uç kimlerin kayıtlı olduğunu öğrenmek için
    // kullanılabilirdi.
    expect("error" in a && "error" in b && a.error).toBe(b && "error" in b ? b.error : "");
  });

  it("anahtar tanımlı değilse kurtarma tamamen kapalıdır", async () => {
    delete process.env.ARICIMAP_RECOVERY_KEY;
    await kullanici(ctx, "Yonetici", "05551110001", "unutuldu");
    expect(ctx.recovery.recoveryEnabled()).toBe(false);
    const sonuc = await ctx.recovery.recoverWithKey(ANAHTAR, "05551110001", "yeniparola");
    expect("error" in sonuc).toBe(true);
  });

  it("kurtarma sonrası eski oturumlar kapanır", async () => {
    const u = await kullanici(ctx, "Yonetici", "05551110001", "unutuldu");
    const jeton = await ctx.accounts.createSession(u.id);
    await ctx.recovery.recoverWithKey(ANAHTAR, "05551110001", "yeniparola");
    expect(await ctx.accounts.userForToken(jeton)).toBeNull();
  });

  it("son çare: anahtarla bir hesap yöneticiye yükseltilir", async () => {
    await kullanici(ctx, "Yonetici", "05551110001");
    const arici = await kullanici(ctx, "Arici", "05551110002");
    expect((await taze(ctx, arici.id)).role).toBe("arici");
    const sonuc = await ctx.recovery.promoteWithKey(ANAHTAR, "05551110002");
    expect("ok" in sonuc).toBe(true);
    expect((await taze(ctx, arici.id)).role).toBe("yonetici");
  });

  it("yükseltme de yanlış anahtarla yapılamaz", async () => {
    await kullanici(ctx, "Yonetici", "05551110001");
    const arici = await kullanici(ctx, "Arici", "05551110002");
    expect("error" in (await ctx.recovery.promoteWithKey("yanlis", "05551110002"))).toBe(true);
    expect((await taze(ctx, arici.id)).role).toBe("arici");
  });

  it("yönetici sayısı raporlanır", async () => {
    await kullanici(ctx, "Yonetici", "05551110001");
    await kullanici(ctx, "Arici", "05551110002");
    expect(await ctx.recovery.adminCount()).toBe(1);
    await ctx.recovery.promoteWithKey(ANAHTAR, "05551110002");
    expect(await ctx.recovery.adminCount()).toBe(2);
  });
});
