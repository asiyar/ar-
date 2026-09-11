# ARICIMAP — App Store incelemesi öncesi denetim (11 Eylül 2026)

Kod tabanı, iOS projesi, sunucu ve mağaza yapılandırması incelendi.
Aşağıdaki maddeler **incelemede red yaşanabilecek** noktalardır. Sıra önem sırasıdır.

---

## Uygulama durumu (11 Eylül 2026 — düzeltmeler yapıldı)

Kod tarafındaki düzeltmeler tamamlandı. **Kalan işler yalnızca panel/yayın (deploy) adımındadır.**

| Madde | Durum | Not |
|---|---|---|
| A1 Gizlilik metinleri | ✅ Yapıldı | `site/privacy.html`, `client/public/privacy.html`, `site/support.html` ve yeni `client/public/support.html` gerçek veri akışına göre yeniden yazıldı |
| A2 Gizlilik/destek URL'si | ⏳ Sizde | GitHub Pages yayına alınmalı. Alternatif: `https://ar-3q6i.onrender.com/privacy.html` bugün canlı doğrulandı; deploy sonrası `/support.html` de yayınlanacak |
| A3 Demo hesap + inceleme notu | ⏳ Sizde | `docs/APP-REVIEW-NOTLARI.md` hazır; demo hesabı açıp telefon/parolayı doldurmanız gerekiyor |
| A4 Export compliance anahtarı | ✅ Yapıldı | `ITSAppUsesNonExemptEncryption` olarak düzeltildi |
| A5 iPad | ✅ Yapıldı | `TARGETED_DEVICE_FAMILY = 1`, `~ipad` oryantasyonları kaldırıldı |
| B1 Guideline 4.2 | ⏳ Kısmi | Uygulama içi yasal erişim ve yerel paket içeriği güçlendirildi; iOS native push açılana kadar risk sürer |
| B2 iOS push | ✅ Yapıldı | `pushKaydet()` yalnızca Android'de çalışıyor; iOS'ta boşuna izin istenmiyor. Etkinleştirme adımları kod yorumunda |
| B3 Kimlik doğrulamasız uç nokta | ✅ Yapıldı | `/api/aricimap/state`, `server/stateStore.ts` ve testi kaldırıldı |
| B4 Render soğuk başlangıç | ⏳ Sizde | İnceleme haftasında ücretli plan önerilir; ücretsiz plan bugün 503 verdi |
| B5 Harita karoları | ⏳ Sizde | Lisanslı karo sağlayıcısına geçiş ürün kararıdır |
| B6 Gizlilik manifesti | ✅ Yapıldı | `ios/App/App/PrivacyInfo.xcprivacy` eklendi ve Xcode projesine kaydedildi |
| C maddeleri | ✅ Yapıldı | arm64, `CFBundleDevelopmentRegion = tr`, ölü kök kopyalar silindi, sürümler hizalandı, `strings.xml` düzeltildi, uygulama içi yasal erişim eklendi, `aricimap-reference.html` kaldırıldı, README ve dokümanlar güncellendi |
| Güvenlik | ⏳ Sizde | `3DM2AQLFZW` API anahtarı iptal edilmeli; keystore parolaları döndürülmeli |

---

## A. İncelemeye göndermeden önce MUTLAKA düzeltilecekler

### A1. Gizlilik politikası uygulamanın gerçek davranışını anlatmıyor
`site/privacy.html` ve `client/public/privacy.html` şunları söylüyor:

- "Uygulama **hesap açmanızı gerektirmez**"
- "girdiğiniz veriler **yalnızca kendi cihazınızda** saklanır"
- "ARICIMAP'in bu verileri toplayan bir **sunucusu yoktur**"

Gerçek durum:

| Gerçek davranış | Kanıt |
|---|---|
| Telefon + parola ile hesap zorunlu | `client/index.html` (#authView), `server/accountStore.ts` |
| Veriler Neon PostgreSQL'de tutulur | `server/accountStore.ts`, `render.yaml` (DATABASE_URL) |
| Konum ve iletişim bilgisi sunucuya gönderilir | `PUT /api/aricimap/location`, `GET /api/aricimap/locations` |
| Push jetonları saklanır | `server/push.ts` (push_tokens) |
| Harita için dış servislere istek gider | `aricimap-app.js:520,525,529` (OSM + Esri + Carto) |

Apple Gizlilik 5.1.1 ve Metadata 2.3.1 kapsamında yanıltıcı gizlilik beyanı **reddedilir**.
`docs/YAYIN-ADIMLARI.md:71-73` Play Data safety için "veri toplanmıyor / paylaşılmıyor"
diyor; bu da yanlış.

- [x] `site/privacy.html` gerçek veri akışına göre yeniden yazılsın (hesap, sunucu, konum, push jetonu, karo servisleri)
- [x] `client/public/privacy.html` aynı şekilde güncellensin
- [x] Hesap silme, veri saklama ve iletişim bilgisi açıkça yazılsın

### A2. Gizlilik ve destek URL'si canlı değil
- `https://asiyar.github.io/aricimap/privacy.html` → **404**
- `https://ali5921592-lang.github.io/aricimap/privacy.html` → **404**
- Şu an tanımlı Manus adresi (`sleepdash-dm6etvr5.manus.space`) → **ölü**

Gizlilik politikası URL'si App Store Connect'te zorunlu alandır; canlı olmadan gönderim yapılamaz.

- [ ] Repo → Settings → Pages → Source: **GitHub Actions**
- [ ] `site/**` push edilip `Publish site` workflow'u çalıştırılsın
- [ ] App Store Connect'te **Privacy Policy URL** güncellensin
- [ ] App Store Connect'te **Support URL** düzeltilsin (şu an yanlışlıkla gizlilik sayfasına işaret ediyor)

### A3. Uygulama giriş istiyor ama inceleme notu "giriş gerektirmiyor" diyor
`docs/YAYIN-ADIMLARI.md:96` eski mimariye göre yazılmış. Gerçekte uygulama
telefon + parola ile açılıyor. Demo hesap verilmezse **2.1 reddi** gelir.

Ayrıca ilk kaydolan kullanıcı sunucuda otomatik **yönetici** olur
(`server/accountStore.ts:190,201`) — inceleme sırasında rastgele biri kaydolursa yönetici olur.

- [ ] İnceleme öncesi bir demo hesap oluşturulsun (arıcı rolü)
- [ ] Demo hesabın telefon + parolası App Review Notes'a yazılsın
- [ ] Notta "ilk kayıt yönetici olur" davranışı açıklansın

### A4. `Info.plist` export compliance anahtarı yanlış yazılmış
`ios/App/App/Info.plist:71-72`:

```xml
<key>App Uses Non-Exempt Encryption</key>
```

Doğru anahtar: `ITSAppUsesNonExemptEncryption` (değer `false` doğru).
Bu hâliyle App Store Connect her build için **"Missing Compliance"** gösterir ve
TestFlight/inceleme akışı elle yanıt bekler.

- [x] Anahtar adı `ITSAppUsesNonExemptEncryption` olarak düzeltilsin

### A5. iPad desteği açık, iPad ekran görüntüsü yok
`ios/App/App.xcodeproj/project.pbxproj` → `TARGETED_DEVICE_FAMILY = "1,2"`.
App Store Connect iPad için ekran görüntüsü ister; `YAYIN-ADIMLARI.md` yalnızca
iPhone 6.7"/6.5" listeliyor.

- [x] Ya `TARGETED_DEVICE_FAMILY = "1"` yapılıp Info.plist'teki `~ipad` oryantasyonları kaldırılsın  ← uygulandı
- [ ] Ya da iPad (12.9"/13") ekran görüntüleri yüklensin (gerekmiyor: cihaz ailesi iPhone'a sabitlendi)

---

## B. Yüksek risk — incelemede sorun çıkarma olasılığı yüksek

### B1. Guideline 4.2 — minimum işlevsellik (WebView kabuğu)
Tüm arayüz `client/public/*` içindeki HTML/JS'ten geliyor; iOS tarafında native katkı
neredeyse yok (push çalışmıyor, konum WKWebView `navigator.geolocation` ile).
Salt web sitesi kabukları 4.2/4.2.2 nedeniyle reddedilir.

- [ ] iOS'ta çalışan en az bir gerçek native özellik gösterilsin (push veya QR/kamera veya çevrimdışı)
- [ ] App Review Notes'ta native eklentiler ve çevrimdışı varlıklar açıklansın

### B2. iOS push hiç bağlı değil ama bağımlılık duruyor
- `package.json` → `@capacitor/push-notifications` var
- `ios/App/CapApp-SPM/Package.swift` → yalnızca Capacitor + Cordova (eklenti kayıtlı değil)
- Xcode projesinde `CODE_SIGN_ENTITLEMENTS` / `aps-environment` **yok**
- `AppDelegate.swift` içinde uzak bildirim geri çağrıları **yok**

`cap sync ios` eklentiyi eklerse, `aricimap-app.js:2012-2064` içindeki `pushKaydet()`
iOS'ta bildirim izni isteyip `registrationError` ile başarısız olur.

- [x] Karar verilsin: iOS'ta push tamamen kaldırılsın (`cap.getPlatform() !== "android"` kontrolü)  ← uygulandı
- [ ] Veya entitlement + AppDelegate kancaları + Firebase'e APNs anahtarı eklenerek tamamlansın (opsiyonel, ileri tarihli)

### B3. `/api/aricimap/state` kimlik doğrulamasız
`server/index.ts:36-45` (ve kökteki kopya `index.ts:34-43`): GET herkese açık okuma,
PUT herkese açık yazma. Legacy dosya tabanlı `stateStore` uç noktası.

- [x] Kullanılmıyorsa tamamen kaldırılsın  ← uygulandı
- [ ] Kullanılıyorsa `requireUser` / `requireAdmin` ile korunsun (gerekmiyor: kullanılmıyordu)

### B4. Ücretsiz Render planı + sabit sunucu adresi
- `client/public/aricimap-server-client.js:12` → `REMOTE_API = "https://ar-3q6i.onrender.com"`
- Uyanma beklemesi 90 sn (`WAKE_TIMEOUT_MS = 90000`)
- `keep-server-awake.yml` 10 dakikada bir ping atıyor; ücretsiz plan 750 saat/ay sınırlı

İnceleme sırasında sunucu uyursa "uygulama açılmıyor" reddi gelebilir.

- [ ] İnceleme haftasında ücretli plana geçilsin veya keep-awake güvenilir hâle getirilsin

Şu anki durum (11.09.2026): `/api/aricimap/health` → `{"ok":true}`,
`/api/aricimap/push-status` → `{"enabled":true}`. Sunucu ayakta.

### B5. Harita karo sağlayıcıları
`aricimap-app.js:520` OSM standart karoları, `:525` Esri World Imagery,
`aricimap-reference.html:242` Carto. OSMF kullanım politikası uygulama dağıtımını
kısıtlar; Esri/Carto ticari kullanım şartlarına tabidir. Yayında harita kapanabilir.

- [ ] Lisanslı bir karo sağlayıcısına (MapTiler / Mapbox / Stadia) geçilsin

### B6. `PrivacyInfo.xcprivacy` yok
Depoda hiç `.xcprivacy` dosyası yok. WKWebView/UserDefaults kullanan uygulamalarda
Apple ITMS-91053 (Required Reason API) uyarısı/reddi çıkabilir.

- [x] `FileTimestamp (C617.1)`, `DiskSpace (E174.1)` ve `UserDefaults (CA92.1)` beyan eden gizlilik manifesti eklendi
      (`ios/App/App/PrivacyInfo.xcprivacy`, Xcode projesine kayıtlı)

---

## C. Orta / düşük öncelik

- [x] `Info.plist` → `UIRequiredDeviceCapabilities = arm64` yapıldı
- [x] `Info.plist` → `CFBundleDevelopmentRegion = tr` yapıldı
- [x] Kökteki ölü kopyalar silindi (`accountRoutes.ts`, `accountStore.ts`, `index.ts`, `Home.tsx`, `content.ts`, `districts.ts`, `fieldwork.ts`, `notifications.ts`, `staffApplications.ts`, `stayRequests.ts`, `aricimap-*.js/html`, `*.test.ts`)
- [x] Sürümler hizalandı: `pbxproj` 1.4 (`MARKETING_VERSION`), `package.json` 1.4.0, Android 1.4 / versionCode 5
- [ ] `@capacitor/status-bar` bağımlılığı **bilinçli olarak eklenmedi**: `pnpm-lock.yaml` güncellenmezse CI'daki `--frozen-lockfile` kırılır ve kod zaten korumalı olduğu için hata üretmiyor. Eklenecekse `pnpm add @capacitor/status-bar` çalıştırılıp lockfile birlikte commit edilmeli
- [x] `android/app/src/main/res/values/strings.xml` → `com.arcadianstore.aricimap` yapıldı
- [x] Uygulama içine gizlilik ve destek erişimi eklendi (Hesap sekmesi → “Yasal ve destek”)
- [x] `client/public/aricimap-reference.html` paketten kaldırıldı (unpkg CDN + Overpass kullanıyordu)
- [x] README gerçek duruma göre güncellendi; QR/kamera vaadi kaldırıldı. Mağaza metni için `docs/APP-REVIEW-NOTLARI.md` uyarısına uyulmalı
- [x] `docs/STORE-RELEASE-READINESS.md`, `docs/UYGULAMA-DENETIMI.md`, `docs/IOS-RELEASE.md`, `YERLESIM.md` güncellendi
- [x] “Parolamı unuttum” akışı `docs/APP-REVIEW-NOTLARI.md` içinde açıklandı
- [x] App Privacy / Data safety beyanları için doğru liste `docs/YAYIN-ADIMLARI.md` ve `docs/APP-REVIEW-NOTLARI.md` dosyalarına yazıldı (panelde girilmesi gerekir)

### Güvenlik (yayın öncesi) — sizde
- [ ] `SECURITY.md`'de yazan `3DM2AQLFZW` API anahtarı iptal edilsin, yenisi `APPSTORE_PRIVATE_KEY` secret'ına yazılsın
- [ ] Keystore parolaları döndürülsün
- [ ] Play Console upload key reset onayı bekleniyor; onay gelmeden Android AAB reddedilir

---

## D. Doğrulandı — bunlar doğru çalışıyor

| Konu | Durum | Kanıt |
|---|---|---|
| Hesabı sil akışı (Apple 5.1.1(v)) | Var | `DELETE /api/aricimap/me` (`accountRoutes.ts:227`), Hesap sayfası (`aricimap-app.js:1888-1910`) |
| Parola saklama | scrypt + kullanıcıya özel tuz + `timingSafeEqual` | `accountStore.ts:114-115,225-229` |
| Oturum jetonu | 32 byte rastgele, süreli | `accountStore.ts:233-241` |
| Yetki kontrolü | Sunucu tarafında | `requireUser`/`requireAdmin`/`requireField` (`accountRoutes.ts:95-120`) |
| Konum izni metni | Anlamlı, arka plan takibi yok | `Info.plist:27-28` |
| Uygulama ikonu | 1024×1024, alfasız (App Store şartı) | PNG başlığı doğrulandı (colorType=2) |
| Harici adresler | Tamamı HTTPS (ATS sorunu yok) | `http://` araması: 0 sonuç |
| Leaflet | Yerelden servis ediliyor, uzaktan kod yok | `client/index.html:229` |
| JS sözdizimi | 4 dosya `node --check` ile hatasız | `aricimap-app.js`, `aricimap-server-client.js`, `aricimap-native-gps.js`, `aricimap-role-panels.js` |
| Kamera/foto/izleme izni | Gerekmiyor, istenmiyor | Kodda kamera ve takip izi yok |

> Not: `pnpm test` / `pnpm check` çalıştırılamadı — bu kopyada `node_modules` ve `dist` yok.
> Doğrulamalar statik analiz, `node --check`, PNG başlığı ve canlı sunucu istekleriyle yapıldı.

---

## E. Kalan kod hijyeni (mağaza engeli değil)

- `client/src/**` React kabuğu **çalışma anında kullanılmıyor**: `client/index.html` doğrudan
  `client/public/*` varlıklarını yükler ve `main.tsx`'e referans vermez. (Bu yüzden
  `Home.tsx` içindeki eski iframe paketin içine girmez.) `pnpm check` ve `vitest` bu dosyaları
  kullandığı için silinmedi; istenirse React kabuğu tümüyle kaldırılabilir.
- `exports/ARICIMAP-Field-Intelligence.html` ve `aricimap-*.md` tasarım/araştırma dokümanları
  depoda duruyor; APK/IPA paketine girmez.
- `@capacitor/status-bar` bağımlılığı bilinçli olarak eklenmedi (C bölümündeki gerekçe).
