# ARICIMAP Android Dağıtımı

## Mevcut durum

`v0.1.0-android-preview` GitHub önizleme sürümünde, yerel olarak derlenmiş **debug APK** bulunur. Bu dosya test içindir; Android debug anahtarıyla imzalanmıştır ve Google Play’e yüklenmez.

## Mağazaya uygun AAB üretimi

Google Play için üretim çıktısı Android App Bundle (`.aab`) olmalıdır. Paket adı kalıcıdır; Play Console’da bir kez seçildikten sonra yeniden kullanılamaz. [1]

Uygulama sahibi bir production keystore oluşturduktan sonra, `android/keystore.properties.example` dosyasını yerelde `android/keystore.properties` adıyla kopyalar. Gerçek dosya ve keystore Git tarafından dışlanır.

```bash
cd android
set -a
source keystore.properties
set +a
./gradlew bundleRelease
```

Çıktı yolu:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## Önce tamamlanması gerekenler

| Gereksinim | Neden gerekli |
|---|---|
| Sahibe ait benzersiz paket adı | `com.<sahip>.aricimap` tanımlayıcısı Google Play’de kalıcıdır. |
| Production keystore ve şifreleri | Play-ready APK/AAB imzalama. Bu değerler yalnızca uygulama sahibinde kalmalıdır. |
| Play Console erişimi | App kaydı, internal test, Data safety ve AAB yükleme. |
| Gizlilik politikası ve destek e-postası | Play store listing ve veri güvenliği beyanı. |
| Test kullanıcıları | Internal/closed test ile cihaz üzeri doğrulama. |

## Referanslar

[1]: https://support.google.com/googleplay/android-developer/answer/9859152?hl=en "Google Play — Create and set up your app"
