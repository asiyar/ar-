# ARICIMAP uygulama kodu denetimi — 28 Ağustos 2026

`client/public/aricimap-reference.html` ve yanındaki iki JS dosyası incelendi.
Bulunan 15 sorun düzeltildi. Aşağıda her biri, neden önemli olduğuyla birlikte.

## Veri kaybına yol açanlar

**1. Açılışta sunucudaki kayıt siliniyordu.**
Açılış sırası `render(); hydrateState();` şeklindeydi. `render()` sonunda
`persist()` çağrılıyor, o da 180 ms sonra state'i sunucuya PUT ediyordu.
`hydrateState()` ise sunucudan GET yapıyordu. GET 180 ms'den uzun sürerse
**boş başlangıç state'i sunucudaki gerçek kayıtların üzerine yazılıyordu.**
Artık `hydrated` bayrağı var; sunucudan okuma tamamlanmadan hiçbir yazma yapılmıyor.

**2. Depolama dolduğunda uygulama kilitleniyordu.**
`persist()` içindeki `localStorage.setItem` try/catch içinde değildi. Reklam
görselleri 900 KB'a kadar base64 olarak aynı yere yazıldığı için kota dolması
gerçekçi bir senaryo. Kota dolunca atılan istisna `render()` zincirini kırıyor,
uygulama yanıt vermez hale geliyordu. Artık hata yakalanıyor ve kullanıcıya
anlaşılır bir uyarı gösteriliyor.

## Çalışmayan özellikler

**3. "Personel girişi" ve "Yönetici paneli" düğmeleri ölüydü.**
İkisi de `openStaff()` çağırıyordu ama bu fonksiyon **hiçbir yerde tanımlı
değildi**. Pratikte `aricimap-role-panels.js` sonradan yüklenip bu iki
düğmeyi yeniden bağladığı için hata görünmüyordu; ancak o dosya yüklenmezse
iki düğme de `ReferenceError` fırlatıyordu. Artık `openRolePanelSafe()`
köprüsü var: panel yüklüyse açıyor, değilse anlaşılır mesaj veriyor.

**4. İl sınırı katmanı hiç yüklenmiyordu.**
`loadProvinceBoundary()` yazılmış ama **hiçbir yerden çağrılmamıştı**.
Diyarbakır sınırı haritada hiç görünmüyordu. Artık açılışta çağrılıyor.

**5. Sınır verisi her açılışta yeniden indiriliyordu.**
Yukarıdaki düzeltmeden sonra her uygulama açılışı Nominatim'e istek atacaktı.
Nominatim'in kullanım politikası bu tür tekrarlı otomatik çağrıları kısıtlar ve
engellemeye kadar gidebilir. Sınır artık ilk indirmede `localStorage`'a
kaydediliyor, sonraki açılışlarda ağa hiç çıkılmıyor.

## Veri bütünlüğü

**6. CSV'de noktalı virgüllü isimler sütunları kaydırıyordu.**
Alanlar hiç tırnaklanmıyordu. "Kulp; Merkez" gibi bir arılık adı raporu
bozuyordu. Artık RFC 4180 tırnaklama uygulanıyor.

**7. CSV formül enjeksiyonuna açıktı.**
`=`, `+`, `-`, `@` ile başlayan bir arılık adı Excel'de **formül olarak
çalışıyordu**. Bu, dosyayı açan kişide kod çalıştırmaya kadar gidebilen bilinen
bir saldırı yöntemi. Bu karakterlerle başlayan alanlar artık tek tırnakla
etkisizleştiriliyor.

**8. CSV Excel'de Türkçe karakterleri bozuyordu.**
UTF-8 BOM eklendi, satır sonları `\r\n` yapıldı.

**9. İndirme yarıda kalabiliyordu.**
`URL.revokeObjectURL` `click()` ile aynı anda çağrılıyordu; bazı tarayıcılar
indirmeyi iptal ediyor. Artık 1 saniye gecikmeli.

**10. Boş kovan sayısı geçerli sayılıyordu.**
Denetim formunda alan boş bırakılınca `Number('')` → `0` oluyor ve doğrulamayı
geçiyordu. Sonuç: "0 kovan gözlendi" diye gerçek olmayan bir denetim kaydı ve
buna dayalı yanlış fark uyarısı. Artık boş değer ve ondalıklı sayı reddediliyor.

**11. Kovan sayısı ondalıklı ve negatif kabul ediyordu.**
`2.7 kovan` kaydedilebiliyordu. Artık 1 veya daha büyük tam sayı zorunlu.

## Güvenlik

**12. `esc()` tek tırnağı kaçırmıyordu.**
Tek tırnaklı bir HTML özniteliği bağlamında öznitelikten kaçış mümkündü.

**13. `esc(0)` boş string döndürüyordu.**
`String(v||'')` kullanıldığı için `0` değeri ekranda kayboluyordu. `??` ile düzeltildi.

**14. Reklam bağlantısında şema doğrulaması yoktu.**
Yönetici panelinden girilen web sitesi alanı doğrudan `window.open`'a
veriliyordu. `javascript:` şemalı bir değer kod çalıştırabilirdi. Artık
yalnızca `http`, `https` ve temizlenmiş `tel:` bağlantılarına izin var.

## Dayanıklılık

**15. Harita yüklenemediğinde uygulama çöküyordu.**
`initMap()` Leaflet yoksa düzgün bir hata ekranı gösteriyordu, ama arılık
listesinden bir kayıt seçmek, paylaşımı haritada göstermek veya GPS almak
`map.setView` çağırıp `TypeError` fırlatıyordu. Beş çağrı noktasına da kontrol
eklendi; harita yokken uygulamanın geri kalanı çalışmaya devam ediyor.

---

## Doğrulama

- Üç dosyanın da sözdizimi `node --check` ile doğrulandı
- Düzeltilen saf fonksiyonlar (`csvCell`, `esc`, `safeUrl`) 11 kenar durumu ve
  saldırı girdisiyle test edildi, hepsi geçti
- `pnpm build` uyarısız tamamlandı
- Sunucu ayağa kaldırılıp tüm rotalar ve `/api/aricimap/state` PUT/GET
  döngüsü doğrulandı

## Denetlenmedi

Bu denetim statik inceleme ve birim testine dayanıyor. Gerçek cihazda
doğrulanması gerekenler: GPS izin akışı, harita dokunmatik davranışı,
büyük kayıt sayısında performans.

---

# İkinci tur — React katmanı ve native köprü

İlk turda yalnızca `aricimap-reference.html` denetlenmişti. `client/src/` altındaki
React kabuğu ve Capacitor köprüsü de incelendi.

## 16. Capacitor Geolocation eklentisi hiçbir zaman çalışmıyordu

`client/src/pages/Home.tsx` tüm uygulamayı bir `<iframe>` içinde açıyor.
Capacitor'ün native köprüsü ise yalnızca ana çerçeveye enjekte ediliyor.
`@capacitor/ios` 8.5.0 kaynağında üç enjeksiyon noktasının üçü de:

```swift
WKUserScript(source: data, injectionTime: .atDocumentStart, forMainFrameOnly: true)
```

Yani iframe içinde `window.Capacitor` tanımsız. `aricimap-native-gps.js`
içindeki `nativePlugin()` her zaman `null` dönüyor ve kod zaten
`navigator.geolocation`'a düşüyor.

Sonuç: iOS derlemesini bozan eklenti **çalışma anında hiç kullanılmıyordu**.
Kaldırıldı. Davranış değişmiyor, çünkü zaten kullanılan yol tarayıcı API'siydi.

Android tarafında da güvenli: `BridgeWebChromeClient.onGeolocationPermissionsShowPrompt`
tarayıcı konum isteğini yakalayıp `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
izinlerini kendisi istiyor. İzinler `AndroidManifest.xml` içinde zaten tanımlı.

Bu değişiklik `docs/IOS-ARCHIVE-HATASI.md` içindeki A seçeneğidir; artık tahmin
değil, kaynak koddan doğrulanmış bir tespit.

## 17. iframe'e açık geolocation izni eklendi

Aynı köken için Permissions Policy varsayılanı zaten izin veriyor, ancak
WKWebView'in özel `capacitor://` şemasıyla davranışı garanti değil.
`allow="geolocation"` açıkça eklendi.

## 18. Ölü React dosyaları

Hiçbir yerden import edilmeyen dosyalar silindi:
`components/Map.tsx` (155 satır), `lib/communityData.ts`, `lib/fieldOperations.ts`
ve bunların testleri. Testleri geçiyordu ama kod hiç çalışmıyordu; bu, kapsam
ölçümünü yanıltıcı hale getiriyordu.

## 19. Sunucu testleri hiç çalışmıyordu

Vite'ın root'u `client/` olduğu için `vitest` yalnızca orayı tarıyordu.
`server/stateStore.test.ts` ve `server/appConfig.test.ts` **hiç çalıştırılmamıştı**.
Kök dizine `vitest.config.ts` eklendi; test sayısı 1'den 3'e çıktı.

## Hâlâ açık olan mimari soru

React kabuğu (wouter, shadcn/ui, Toaster, TooltipProvider, ThemeProvider)
sadece tek bir iframe göstermek için **410 KB** varlık üretiyor. İşlevsel bir
karşılığı yok. `client/index.html` doğrudan referans uygulamasına
dönüştürülürse bu tamamen ortadan kalkar ve iframe katmanı da kalkmış olur.

Bu, çalışan bir yapıyı değiştirmek anlamına geldiği için bilinçli olarak
yapılmadı. Yayın sonrası ele alınabilecek bir sadeleştirme.

---

# Üçüncü tur — yönetici ve personel erişimi

`aricimap-role-panels.js` (533 satır) ve rol kontrol mantığı incelendi.

## 20. Uygulama her açılışta YÖNETİCİ yetkisiyle başlıyordu

Rol, üst menüdeki `<select id="role">` öğesinden okunuyor. Seçeneklerin
sırası şuydu:

```html
<option>ARICIMAP Yöneticisi</option>   <!-- ilk seçenek = varsayılan -->
<option>Topluluk Koordinatörü</option>
<option>Saha Gönüllüsü</option>
<option>Arıcı</option>
```

HTML'de ilk `<option>` varsayılan seçilidir. Yani uygulamayı indiren herkes
**ilk açılışta tam yönetici yetkisiyle** başlıyordu: reklam yönetimi, duyuru
yayınlama, personel onaylama, atama yapma.

Sıra değiştirildi, varsayılan artık `Arıcı`.

## 21. Seçilen rol hiç saklanmıyordu

Sayfa her yenilendiğinde rol varsayılana dönüyordu. Rol artık `state.role`
içinde saklanıyor ve açılışta `restoreRole()` ile geri yükleniyor.

## 22. Yönetici yetki kontrolü dairesel ve etkisizdi

"Yönetici paneli" kartının kodu şuydu:

```js
$('#adminPanel').onclick = () => {
  $('#role').value = 'ARICIMAP Yöneticisi';   // önce rolü yükselt
  openRolePanel('manager');                    // sonra rolü kontrol et
};
```

`openRolePanel` içindeki `if (mode === "manager" && !hasManagerRole())`
kontrolü bu yoldan **asla başarısız olamıyordu**, çünkü hemen öncesinde rol
yöneticiye çevriliyordu. Kontrol tamamen dekoratifti.

Kart artık rolü kendisi yükseltmiyor; kullanıcının üst menüden bilinçli
olarak rol seçmesi gerekiyor.

## 23. Ölü personel modalı kullanıcıya yalan söylüyordu

`staffExtension()` içinde ikinci bir personel modalı vardı. `navStaff`
düğmesine kendi `onclick`'ini bağlıyor, ancak `aricimap-role-panels.js`
sonradan yüklenip bu bağlamayı eziyordu — yani modal hiç açılmıyordu.

İçindeki "Başvuru gönder" düğmesi şunu yapıyordu:

```js
$('#requestStaff').onclick = () => {
  toast('Başvurunuz yönetici onayı için kaydedildi.');
  closeModal('staffModal');
}
```

Hiçbir şey kaydetmeden "kaydedildi" diyordu. Ölü kod olduğu için pratikte
kimseyi etkilemiyordu, ama silindi (2209 → 209 karakter). Geriye yalnızca
`navStaff` düğmesinin oluşturulması kaldı; onu zaten role-panels bağlıyor.

## Düzgün çalışan kısımlar

`aricimap-role-panels.js` içindeki asıl akış sağlam:

- Personel başvurusu gerçekten `state.staffRequests` içine yazılıyor
- Aynı iletişim bilgisiyle mükerrer başvuru engelleniyor
- Onay `P-001` biçiminde personel kodu üretiyor, denetim izi bırakıyor
- Atama, konaklama talebi ve harita üzerinde işaretleme çalışıyor

## Çözülemeyen: gerçek kimlik doğrulama yok

Yukarıdaki düzeltmeler varsayılanı güvenli hale getiriyor ve yanıltıcı
kontrolleri kaldırıyor. Ancak **rol hâlâ bir açılır menüden seçiliyor.**
İsteyen herkes "ARICIMAP Yöneticisi" seçip yönetici paneline girebilir.

Bu istemci tarafında çözülemez. Tüm veri kullanıcının cihazındaki
`localStorage`'da tutuluyor; kullanıcı isterse doğrudan düzenleyebilir.
Gerçek rol ayrımı için sunucu tarafında hesap, oturum ve yetki denetimi
gerekir — yani `server/` tarafında kimlik doğrulama ve rol bazlı API koruması.

Mevcut haliyle rol seçici bir **güvenlik sınırı değil, kolaylık anahtarıdır.**
Uygulama tek kullanıcılık bir saha aracı olarak kullanılacaksa sorun değildir.
Farklı yetkilere sahip birden çok kişi aynı veriyi paylaşacaksa, mağaza
yayınından önce sunucu tarafı kimlik doğrulama eklenmelidir.

---

# Dördüncü tur — akış akış doğrulama

Her rol akışı baştan sona izlendi. Sonuç:

| Akış | Durum |
|---|---|
| Personel başvurusu gönderme | Çalışıyor — `state.staffRequests` içine yazılıyor, mükerrer engelleniyor |
| Yönetici onay / red | Çalışıyor — durum güncelleniyor, denetim izi ve bildirim üretiliyor |
| Onay sonrası personel kodu | **Düzeltildi**, aşağıya bak |
| Arılık → personel ataması | Çalışıyor — mükerrer atama engelleniyor, kaldırma çalışıyor |
| Personelin atanmış arılıkları görmesi | Çalışıyor |
| Atanmış arılıktan denetim başlatma | Çalışıyor — `openInspection` çağrılıyor |
| Konaklama talebi oluşturma | Çalışıyor — harita seçimi, onay kutusu ve zorunlu alanlar doğrulanıyor |
| Konaklama talebi karara bağlama | Çalışıyor — durum stringleri (`İnceleme bekliyor` / `Yer ayrıldı` / `Uygun yer yok`) tutarlı |
| Haritada konaklama işaretleri | Çalışıyor — harita yoksa güvenli çıkış yapıyor |

## 24. Personel kodu çakışabiliyordu

```js
const code = `P-${String(state.staff.length + 1).padStart(3, "0")}`;
```

Kod, dizinin **uzunluğundan** üretiliyordu. Kayıtlar sunucu üzerinden iki cihaz
arasında birleştiğinde veya iki onay yakın zamanda verildiğinde aynı kod iki
kişiye çıkabiliyordu. Personel kodu kimlik olarak kullanıldığı için bu,
yanlış kişiye atama yapılmasına yol açabilirdi.

Artık mevcut en yüksek koddan devam ediliyor. 5 kenar durumuyla test edildi,
hepsi geçti.

## Doğrulanan: global fonksiyon paylaşımı

`aricimap-role-panels.js`, `openAdmin`, `openInspection`, `audit`, `notify`,
`persist`, `render`, `toast`, `state`, `map` gibi tanımları
`aricimap-reference.html` içindeki script'ten alıyor. O script bir IIFE içine
sarılmadığı için bu tanımlar gerçekten global. Bağlantı sağlam.

## Bilinen sınır: "personel girişi" bir giriş değil

Personel çalışma alanı, `selectedStaffId()` ile **listedeki ilk onaylı
personeli** aktif kabul ediyor. Kişi kendini tanıtmıyor, parola veya kod
girmiyor. Panelin başlığı da bunu söylüyor: "AKTİF DEMO PERSONELİ".

Yani iki farklı saha personeli aynı cihazda birbirinin görevlerini görür.
Bu bir hata değil, tasarımın demo olması. Gerçek personel ayrımı için
sunucu tarafında oturum gerekir.
