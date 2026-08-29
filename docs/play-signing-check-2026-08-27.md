# ARICIMAP Play Signing Kontrolü — 27 Ağustos 2026

Play Console hesabı: Arcadian Store, hesap kimliği `8937329281009825001`.

Uygulama: ARICIMAP, paket `com.arcadianstore.aricimap`, uygulama kimliği `4973273475261854762`.

Play Console uygulama listesinde uygulama **Kapalı test** durumunda ve son güncelleme 26 Ağustos 2026 olarak görünüyor. Test ve yayınlama ekranında alpha kapalı test kanalı mevcut; görünen sürüm 1 (1.0), yayın zamanı 23 Ağustos 2026. Bu nedenle 1.4 (versionCode 5) paketinin henüz kanala yüklenmediği doğrulandı.

## Yeni upload key sonucu

ARICIMAP için yeni Android upload keystore ve PEM sertifikası oluşturuldu. Yeni PEM sertifikası Play Console App Signing ekranındaki **Yükleme anahtarı sıfırlama** formuna başarıyla yüklendi ve reset isteği gönderildi.

Play Console şu anda şu durumu gösteriyor: **“Bu uygulamanın yükleme anahtarının sıfırlanması için bekleyen bir istek var.”** Yeni upload key, Google’ın onayından sonra etkinleşecektir. Onaydan önce yeni AAB’nin Play Console’a gönderilmesi beklenen şekilde reddedilebilir.

| Alan | Değer |
|---|---|
| Keystore | `aricimap-upload.jks` |
| Alias | `aricimap-upload` |
| Sertifika | `aricimap-upload-cert.pem` |
| Sertifika SHA-256 | `6E:60:DA:4C:C0:24:1F:A4:87:49:1D:F3:89:10:C7:68:34:D1:5D:F9:1C:14:74:19:2B:BE:C2:85:EB:9C:82:25` |
| Play Console durumu | Reset isteği beklemede |

Keystore parolaları ayrı ve erişim izinleri kısıtlanmış `credentials.env` dosyasındadır. Bu dosya Git deposuna gönderilmemelidir.

## Sonraki adım

Reset isteği Play Console tarafından onaylandıktan sonra Android 1.4 sürümü yeni keystore ile imzalanarak AAB olarak kapalı test kanalına yüklenebilir. iOS tarafındaki CI/CD secrets kurulumu da özel Apple imza materyallerinin ayrıca sağlanmasını gerektirir.

## Resmî kaynak

Google Play Console upload key reset yönergesi: [Google Play yardım merkezi](https://support.google.com/googleplay/android-developer/answer/9842756?hl=tr).

> Güvenlik notu: `aricimap-upload.jks` ve `credentials.env` özel anahtar materyalidir. Bunlar herkese açık depoya, issue yorumuna veya CI loglarına eklenmemelidir.
