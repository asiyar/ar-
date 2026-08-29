import { describe, it, expect, beforeEach, vi } from "vitest";
/** Her test gerçek bir PostgreSQL veritabanına karşı, boş tablolarla çalışır. */
async function freshStore() {
  const store = await import("./accountStore");
  await store.resetForTests();
  return store;
}

describe("hesap ve görünürlük kuralları", () => {
  let store: Awaited<ReturnType<typeof freshStore>>;

  beforeEach(async () => {
    store = await freshStore();
  });

  it("ilk kayıt olan kişi kurucu yönetici olur, sonrakiler onay bekler", async () => {
    const first = await store.registerUser("Murat", "05551110001", "gizli123");
    const second = await store.registerUser("Ahmet", "05551110002", "parola123");
    expect("user" in first && first.user.role).toBe("yonetici");
    expect("user" in first && first.user.status).toBe("onayli");
    expect("user" in second && second.user.role).toBe("arici");
    expect("user" in second && second.user.status).toBe("beklemede");
  });

  it("aynı telefon numarasıyla ikinci kayıt reddedilir", async () => {
    await store.registerUser("Murat", "0555 111 00 01", "gizli123");
    const again = await store.registerUser("Başkası", "05551110001", "baska123");
    expect("error" in again).toBe(true);
  });

  it("parola düz metin olarak saklanmaz", async () => {
    const created = await store.registerUser("Murat", "05551110001", "gizli123");
    if (!("user" in created)) throw new Error("kayıt başarısız");
    const users = await store.listUsers();
    const raw = JSON.stringify(users);
    expect(raw).not.toContain("gizli123");
    expect(created.user.passwordHash).not.toContain("gizli123");
  });

  it("yanlış parola reddedilir, doğru parola kabul edilir", async () => {
    await store.registerUser("Murat", "05551110001", "gizli123");
    expect("error" in (await store.verifyLogin("05551110001", "yanlis"))).toBe(true);
    expect("user" in (await store.verifyLogin("05551110001", "gizli123"))).toBe(true);
  });

  it("arıcı yalnızca kendi konumunu görür", async () => {
    const admin = await store.registerUser("Murat", "05551110001", "gizli123");
    const a = await store.registerUser("Ahmet", "05551110002", "parola123");
    const b = await store.registerUser("Veli", "05551110003", "parola123");
    if (!("user" in admin) || !("user" in a) || !("user" in b)) throw new Error("kayıt başarısız");

    await store.decideUser(a.user.id, true, false);
    await store.decideUser(b.user.id, true, false);
    await store.upsertLocation(a.user.id, { lat: 38.1, lng: 40.2 });
    await store.upsertLocation(b.user.id, { lat: 38.5, lng: 41.0 });

    const seenByA = await store.locationsVisibleTo((await store.listUsers()).find((u) => u.id === a.user.id)!);
    expect(seenByA).toHaveLength(1);
    expect(seenByA[0].ownerName).toBe("Ahmet");
  });

  it("arıcıya başkasının telefon numarası dönmez", async () => {
    const admin = await store.registerUser("Murat", "05551110001", "gizli123");
    const a = await store.registerUser("Ahmet", "05551110002", "parola123");
    if (!("user" in admin) || !("user" in a)) throw new Error("kayıt başarısız");
    await store.decideUser(a.user.id, true, false);
    await store.upsertLocation(a.user.id, { lat: 38.1, lng: 40.2 });

    const fresh = (await store.listUsers()).find((u) => u.id === a.user.id)!;
    const rows = await store.locationsVisibleTo(fresh);
    expect(rows[0].ownerPhone).toBeNull();
  });

  it("personel ve yönetici tüm konumları telefon bilgisiyle görür", async () => {
    const admin = await store.registerUser("Murat", "05551110001", "gizli123");
    const a = await store.registerUser("Ahmet", "05551110002", "parola123");
    const b = await store.registerUser("Veli", "05551110003", "parola123");
    if (!("user" in admin) || !("user" in a) || !("user" in b)) throw new Error("kayıt başarısız");

    await store.decideUser(a.user.id, true, true); // personel
    await store.decideUser(b.user.id, true, false);
    await store.upsertLocation(a.user.id, { lat: 38.1, lng: 40.2 });
    await store.upsertLocation(b.user.id, { lat: 38.5, lng: 41.0 });

    const users = await store.listUsers();
    const staff = users.find((u) => u.id === a.user.id)!;
    expect(staff.role).toBe("personel");
    expect(staff.staffCode).toBe("P-001");

    const seenByStaff = await store.locationsVisibleTo(staff);
    expect(seenByStaff).toHaveLength(2);
    expect(seenByStaff.every((r) => r.ownerPhone !== null)).toBe(true);

    const seenByAdmin = await store.locationsVisibleTo(users.find((u) => u.id === admin.user.id)!);
    expect(seenByAdmin).toHaveLength(2);
  });

  it("personel kodları çakışmaz", async () => {
    await store.registerUser("Murat", "05551110001", "gizli123");
    const a = await store.registerUser("Ahmet", "05551110002", "parola123");
    const b = await store.registerUser("Veli", "05551110003", "parola123");
    if (!("user" in a) || !("user" in b)) throw new Error("kayıt başarısız");
    await store.decideUser(a.user.id, true, true);
    await store.decideUser(b.user.id, true, true);
    const codes = (await store.listUsers()).map((u) => u.staffCode).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain("P-001");
    expect(codes).toContain("P-002");
  });

  it("konum güncellemesi yeni kayıt oluşturmaz, mevcudu değiştirir", async () => {
    const admin = await store.registerUser("Murat", "05551110001", "gizli123");
    if (!("user" in admin)) throw new Error("kayıt başarısız");
    await store.upsertLocation(admin.user.id, { lat: 38.1, lng: 40.2 });
    await store.upsertLocation(admin.user.id, { lat: 39.9, lng: 41.5, hives: 20 });
    const rows = await store.locationsVisibleTo(admin.user);
    expect(rows).toHaveLength(1);
    expect(rows[0].lat).toBe(39.9);
    expect(rows[0].hives).toBe(20);
  });

  it("oturum jetonu kullanıcıyı doğru çözer ve çıkışta geçersizleşir", async () => {
    const admin = await store.registerUser("Murat", "05551110001", "gizli123");
    if (!("user" in admin)) throw new Error("kayıt başarısız");
    const token = await store.createSession(admin.user.id);
    expect((await store.userForToken(token))?.id).toBe(admin.user.id);
    await store.destroySession(token);
    expect(await store.userForToken(token)).toBeNull();
  });
});
