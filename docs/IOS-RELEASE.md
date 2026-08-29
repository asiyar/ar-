# ARICIMAP iOS / TestFlight Hazırlığı

## Oluşturulan iOS kabuğu

| Alan | Değer |
|---|---|
| Bundle ID | `com.arcadianstore.aricimap` |
| Uygulama adı | `ARICIMAP` |
| Sürüm | `1.0` (`1`) |
| Konum izni | `NSLocationWhenInUseUsageDescription` |
| Konum davranışı | Yalnızca kullanıcının GPS/konum paylaşımı eylemiyle; arka plan konumu yok |
| Native eklenti | `@capacitor/geolocation` 8.2.2, Swift Package Manager ile kaydedildi |

`Info.plist` içinde konum açıklaması şudur:

> ARICIMAP, yalnızca “GPS ile konum al” veya “Konumumu paylaş” seçtiğinizde arılığı haritada göstermek için konumunuzu kullanır. Konumunuz arka planda izlenmez.

## Doğrulanan eşitleme

`pnpm build`, referans HTML varlıklarının `dist/public` alanına kopyalanması ve `pnpm exec cap sync ios` komutları başarıyla çalıştı. iOS uygulamasına kopyalanan `ios/App/App/public/index.html`, kaynak `client/public/aricimap-reference.html` ile aynı SHA-256 özetine sahiptir.

## TestFlight blokajı

Bu Linux ortamı Xcode ve Apple imzalama araçlarını içermez. Bu nedenle burada iOS projesi oluşturulup yapılandırılabilir; ancak IPA arşivleme, provisioning profile/certificate seçimi, App Store Connect’e build yükleme ve TestFlight dağıtımı için macOS üzerinde Xcode ya da güvenilir bir macOS CI ortamı gerekir.

App Store Connect kayıt ve metadata taslağı oluşturulmuştur; **App Review gönderimi veya canlı App Store yayını yapılmamıştır**.
