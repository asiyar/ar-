# iOS Archive hatası — teşhis ve seçenekler

Belirti: `Build and upload iOS IPA` işi `Archive` adımında `exit code 65` ile düşüyor. Hata `GeolocationPlugin` hedefinde, `CapacitorGeolocation` projesinde, `(2 failures)` olarak raporlanıyor.

Yani derleyemediği şey **senin kodun değil**, `@capacitor/geolocation` eklentisinin Swift kaynağı.

---

## Önce: gerçek hata satırlarını çıkar

Ekran görüntüsünde yalnızca derlenen dosyaların listesi görünüyor, hatanın kendisi değil. Gerçek sebep şu iki satırda yazıyor ve onlar olmadan teşhis tahminden ibaret kalır.

1. Başarısız işi aç
2. Sağ üstteki dişli → **View raw logs**
3. Ctrl+F ile `error:` ara (iki nokta dahil)
4. `error:` ile başlayan satırları kopyala

Aradığın şey şuna benzer:

```
/Users/runner/.../GeolocationCallbackManager.swift:118:18: error: value of type 'CAPPluginCall' has no member 'keepAlive'
```

Bu satırlar elimize geçtiğinde hedefe yönelik düzeltme yapılabilir.

---

## Seçenek A — Eklentiyi tamamen kaldır (önerilen)

Bu proje için `@capacitor/geolocation` aslında gereksiz. `client/public/aricimap-native-gps.js` dosyasındaki köprü zaten şöyle çalışıyor:

```js
const plugin = nativePlugin();
if (!plugin) return browserPosition();   // navigator.geolocation
```

Eklenti yoksa kod sessizce tarayıcının `navigator.geolocation` API'sine düşüyor. iOS 15+ WKWebView bunu yerel olarak destekler ve Capacitor içeriği güvenli bağlam (`capacitor://localhost`) üzerinden sunar. Konum izni penceresi `Info.plist` içindeki `NSLocationWhenInUseUsageDescription` ile aynı şekilde çıkar — o anahtar zaten yerinde.

Yani eklentiyi kaldırmak **JavaScript tarafında sıfır değişiklik** gerektiriyor ve hatanın kaynağı olan derleme hedefini tümden ortadan kaldırıyor.

```bash
pnpm remove @capacitor/geolocation
rm -rf ios android
pnpm build
pnpm exec cap add ios
bash scripts/apply-native-overrides.sh ios
pnpm exec cap sync ios
```

Sonra workflow'u tekrar çalıştır.

**Doğrulanması gereken nokta:** WKWebView'in `navigator.geolocation` davranışını gerçek bir iPhone'da test et. Simülatörde değil. TestFlight build'i geldiğinde "GPS konumum" düğmesine bas ve izin penceresinin çıktığını, konumun alındığını gör. Çalışmazsa Seçenek B'ye dön — bu adım geri alınabilir.

Android tarafında da aynı geçerli: Android WebView `navigator.geolocation`'ı destekler, Capacitor `ACCESS_FINE_LOCATION` iznini yönetir.

---

## Seçenek B — Eklentiyi koru, sürümleri hizala

`@capacitor/geolocation` için yayınlanmış en yüksek sürüm `8.2.2`. Yani "eklentiyi güncelle" gibi bir çıkış yok; eklenti çekirdeğin gerisinde.

`8.2.2` npm üzerinde `@capacitor/core >=8.0.0` peer bağımlılığı ilan ediyor, yani kâğıt üzerinde `8.5.0` ile uyumlu görünüyor. Derleme hatası bu ilanın gerçeği yansıtmadığını gösteriyor olabilir — 8.5 iOS tarafında kırıcı değişiklikler getiren bir minor sürüm.

Bu durumda çekirdeği eklentinin gerçekten test edildiği sürüme çekmek gerekir:

```bash
pnpm add @capacitor/core@8.4.2 @capacitor/ios@8.4.2 @capacitor/android@8.4.2
pnpm add -D @capacitor/cli@8.4.2
rm -rf ios android
pnpm build && pnpm exec cap add ios
bash scripts/apply-native-overrides.sh ios
pnpm exec cap sync ios
```

Not: 8.4.2'ye düşersen UIScene geçişi zorunlu olmaktan çıkar ama zararı da olmaz — `SceneDelegate.swift` ve Info.plist manifesti yerinde kalabilir.

Bu seçeneği ancak Seçenek A gerçek cihazda başarısız olursa dene. Sürüm düşürmek, ileride tekrar yükseltilmesi gereken bir borç yaratır.

---

## Seçenek C — Eklentiyi yamala

Hata satırları gerçekten küçük bir API uyumsuzluğunu gösteriyorsa (`keepAlive`, `CAPPluginCall` uzantıları gibi), `pnpm patch` ile eklentinin Swift kaynağı yamalanabilir.

Bu en kırılgan seçenek: yama her eklenti güncellemesinde bozulur ve native kodu elle taşımak anlamına gelir. Yalnızca A ve B'nin ikisi de başarısız olursa düşün.

---

## Neyin sebep **olmadığı**

- **Xcode sürümü değil.** Capacitor'ün 8.5 rehberi UIScene'i zorunlu kılanın Xcode 27 olduğunu, 8.5 çekirdeğinin hâlâ AppDelegate yolunu desteklediğini söylüyor. `macos-26` runner'ı zaten çalıştı ve derleme `Archive` adımına kadar geldi — runner seçimi sorun değil.
- **İmzalama değil.** Sertifika ve provisioning profile adımları başarılı geçti; iş Swift derlemesinde düştü.
- **UIScene geçişi değil.** `SceneDelegate.swift`, Info.plist manifesti ve `AppDelegate` hook'u rehberdeki şekliyle yerinde. Hata `App` hedefinde değil, `GeolocationPlugin` hedefinde.
