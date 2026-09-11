# ARICIMAP iOS / TestFlight Hazırlığı

## Oluşturulan iOS kabuğu

| Alan | Değer |
|---|---|
| Bundle ID | `com.arcadianstore.aricimap` |
| Uygulama adı | `ARICIMAP` |
| Sürüm | `1.4` (derleme numarası CI'da `github.run_number`) |
| Konum izni | `NSLocationWhenInUseUsageDescription` |
| Konum davranışı | Yalnızca kullanıcının GPS/konum paylaşımı eylemiyle; arka plan konumu yok |
| Cihaz desteği | Yalnızca iPhone (`TARGETED_DEVICE_FAMILY = 1`), iPad kapalı |
| Gizlilik manifesti | `ios/App/App/PrivacyInfo.xcprivacy` |
| Native eklenti | `@capacitor/push-notifications` (yalnızca Android'de etkin; iOS'ta APNs bekliyor) |

`Info.plist` içinde konum açıklaması şudur:

> ARICIMAP, yalnızca “GPS ile konum al” veya “Konumumu paylaş” seçtiğinizde arılığı haritada göstermek için konumunuzu kullanır. Konumunuz arka planda izlenmez.

## Doğrulanan eşitleme

`pnpm build`, arayüz varlıklarını (`client/public/*` → `dist/public`) kopyalar ve `pnpm exec cap sync ios` iOS projesini bu çıktıyla eşitler. iOS paketine giren `ios/App/App/public/index.html` kaynak `client/index.html` ile aynı içeriktir.

## TestFlight blokajı

Bu Linux ortamı Xcode ve Apple imzalama araçlarını içermez. Bu nedenle burada iOS projesi oluşturulup yapılandırılabilir; ancak IPA arşivleme, provisioning profile/certificate seçimi, App Store Connect’e build yükleme ve TestFlight dağıtımı için macOS üzerinde Xcode ya da güvenilir bir macOS CI ortamı gerekir.

App Store Connect kayıt ve metadata taslağı oluşturulmuştur; **App Review gönderimi veya canlı App Store yayını yapılmamıştır**.
