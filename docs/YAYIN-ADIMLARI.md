# ARICIMAP — Yayın Adımları

Bu dosya, depo kurulduktan sonra mağaza yayınına kadar yapılacak işleri sırayla listeler. Tamamladıkça kutuları işaretle.

---

## 0. Güvenlik (önce bu)

- [ ] App Store Connect API key `3DM2AQLFZW` iptal edildi, yenisi oluşturuldu
- [ ] Keystore parolaları döndürüldü (`SECURITY.md` içindeki komutlar)
- [ ] `aricimap-upload.jks` şifreli bir yedekte saklanıyor

---

## 1. GitHub

- [ ] Depo oluşturuldu (**Private** olarak başla)
- [ ] Bu dosyalar `main` dalına push edildi
- [ ] `git status` çıktısında hiçbir `.p8` / `.p12` / `.jks` / `.env` görünmüyor
- [ ] Hangi hesabın sahibi olduğu netleştirildi — `docs/ios-build-findings-2026-08-27.md`
      notuna göre `asiyar/aricimap` ve `ali5921592-lang/aricimap` diye iki depo var.
      Tek bir tanesinde birleş, diğerini arşivle.

### Secrets

Settings → Secrets and variables → Actions:

- [ ] `APPLE_TEAM_ID` = `9RFZP8QY57`
- [ ] `APPSTORE_KEY_ID` (yeni key)
- [ ] `APPSTORE_ISSUER_ID` = `dd6c3ffd-4bdc-4cbf-aeca-17298cb5b199`
- [ ] `APPSTORE_PRIVATE_KEY` (yeni `.p8` dosyasının tam içeriği)
- [ ] `IOS_CERTIFICATE_BASE64` (Apple Distribution `.p12`)
- [ ] `IOS_CERTIFICATE_PASSWORD`
- [ ] `IOS_KEYCHAIN_PASSWORD` (kendi seçtiğin geçici parola)
- [ ] `ANDROID_KEYSTORE_BASE64`
- [ ] `ANDROID_KEYSTORE_PASSWORD`
- [ ] `ANDROID_KEY_ALIAS` = `aricimap-upload`
- [ ] `ANDROID_KEY_PASSWORD`

---

## 2. Gizlilik ve destek sayfaları

Mevcut URL'ler Manus'un geçici alan adında (`sleepdash-dm6etvr5.manus.space`). Manus aboneliği bittiğinde bu adresler ölür ve **Apple ile Google başvuruyu reddeder**. Depodaki `site/` klasörü bunun yerine geçer.

- [ ] Settings → Pages → Source: **GitHub Actions**
- [ ] `Publish site` workflow'u çalıştı
- [ ] `https://<kullanıcı>.github.io/aricimap/privacy.html` açılıyor
- [ ] `https://<kullanıcı>.github.io/aricimap/support.html` açılıyor
- [ ] App Store Connect'te Privacy Policy URL yeni adresle güncellendi
- [ ] App Store Connect'te Support URL yeni adresle güncellendi (şu an yanlışlıkla gizlilik sayfasına işaret ediyor)
- [ ] Play Console'da gizlilik politikası URL'si güncellendi

---

## 3. Android

- [ ] Play Console → App signing ekranında upload key reset **onaylandı**
      (onay gelmeden yüklenen AAB reddedilir)
- [ ] Yeni sertifikanın SHA-256'sı Play Console'dakiyle eşleşiyor:
      `6E:60:DA:4C:C0:24:1F:A4:87:49:1D:F3:89:10:C7:68:34:D1:5D:F9:1C:14:74:19:2B:BE:C2:85:EB:9C:82:25`
- [ ] `Android Release AAB` workflow'u çalıştırıldı, AAB artifact indirildi
- [ ] AAB, Kapalı test (Alpha) kanalına yüklendi — `versionCode 5`, `versionName 1.4`
- [ ] Test kullanıcıları (`atekin592@gmail.com`, `muratvet21@gmail.com`) gerçek cihazda
      `https://play.google.com/apps/testing/com.arcadianstore.aricimap` üzerinden katıldı
- [ ] Cihazda GPS, harita ve arılık kaydı akışları doğrulandı

### Play Console formları

- [ ] Mağaza listelemesi (açıklama, ekran görüntüleri, ikon)
- [ ] **Data safety** formu — bu uygulama için doğru cevaplar:
      veri toplanmıyor, veri paylaşılmıyor, konum yalnızca cihazda işleniyor.
      Ayrıntı için `site/privacy.html` içeriğine bak.
- [ ] İçerik derecelendirmesi anketi
- [ ] Hedef kitle ve içerik
- [ ] Reklam beyanı: reklam yok

---

## 4. iOS

- [ ] `iOS TestFlight` workflow'u elle çalıştırıldı (`workflow_dispatch`)
- [ ] Build App Store Connect'te işlendi, TestFlight'ta göründü
- [ ] TestFlight iç test grubuna test kullanıcıları eklendi
- [ ] Gerçek iPhone'da kurulup GPS ve harita doğrulandı

### App Store Connect formları

- [ ] iPhone ekran görüntüleri yüklendi (6.7" ve 6.5" zorunlu) — şu an 0/10
- [ ] **App Privacy** veri beyanı tamamlandı.
      Uygulama sunucuya veri göndermediği için "Data Not Collected" seçilebilir;
      ancak OpenStreetMap ve Nominatim'e giden harita istekleri
      `site/privacy.html` içinde açıklandığı gibi beyan edilmeli.
- [ ] Privacy Policy URL güncellendi
- [ ] İkincil kategori seçildi (birincil zaten Productivity)
- [ ] App Review notu güncel: uygulama giriş gerektirmiyor, konum yalnızca
      kullanıcı eylemiyle kullanılıyor, arka plan takibi yok

---

## 5. Yayın

- [ ] TestFlight ve Alpha testlerinden geri bildirim toplandı
- [ ] Bulunan hatalar giderildi, sürüm `1.5` / `versionCode 6` olarak yükseltildi
- [ ] Apple: **Submit for Review**
- [ ] Google: Kapalı testten üretim kanalına yükseltme

> Üretim yayını geri alınamaz bir adımdır. İki mağazada da bunu ancak
> gerçek cihaz testleri tamamlandıktan sonra yap.

---

## Bilinen teknik notlar

**Xcode sürümü.** Capacitor 8.5 UIScene lifecycle'ı benimsedi ve Xcode 26+ gerektiriyor. Workflow `macos-26` runner kullanıyor. `macos-14` (Xcode 15.4) ile arşivleme başarısız olur — eski workflow'un çalışmama sebebi buydu.

**altool anahtar yolu.** Eski workflow `xcrun altool`'a yalnızca key ID veriyordu ama `.p8` dosyasını diske yazmıyordu. altool anahtarı `~/.private_keys/AuthKey_<KEYID>.p8` yolunda arar. Yeni workflow bunu yazıyor ve iş bitince siliyor.

**Leaflet.** Harita kütüphanesi artık unpkg.com CDN'inden değil, uygulama paketinin içinden yükleniyor. Bu hem çevrimdışı davranışı düzeltiyor hem de uzaktan kod yükleme konusundaki App Review riskini ortadan kaldırıyor.

**Sürüm çakışması.** Play Console'daki yayınlı sürüm `versionCode 1`. Depo `versionCode 5` ile geliyor, yani çakışma yok.
