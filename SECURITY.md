# Güvenlik

## Bu depoya asla girmeyecek dosyalar

`.gitignore` bunları engeller, ama kural olarak da bilinmeli:

| Dosya türü | Örnek | Ne içerir |
|---|---|---|
| `.p8` | `AuthKey_XXXXXXXXXX.p8` | App Store Connect API özel anahtarı |
| `.p12` | `apple_distribution.p12` | Apple Distribution sertifikası + özel anahtar |
| `.jks` / `.keystore` | `aricimap-upload.jks` | Android upload anahtarı |
| `.env` | `credentials.env` | Keystore parolaları |
| `.mobileprovision` | — | Provisioning profile |

Bunların tümü GitHub Actions secrets olarak saklanır, dosya olarak değil.

## Yapılmış olan sızıntı ve yapılması gerekenler

2026-08-28 tarihinde `AuthKey_3DM2AQLFZW.p8`, `aricimap-upload.jks` ve `credentials.env` dosyaları bir arşiv içinde depo dışına çıkarıldı. Bu dosyalar bu depoya dahil edilmemiştir, ancak anahtarların döndürülmesi gerekir:

- [ ] **App Store Connect API key `3DM2AQLFZW` iptal edilecek.**
      App Store Connect → Users and Access → Integrations → Keys → Revoke.
      Yerine yeni bir Team API key oluştur, `.p8` dosyasını indir ve içeriğini
      `APPSTORE_PRIVATE_KEY` secret'ına yapıştır. `.p8` yalnızca bir kez indirilebilir.
- [ ] **Keystore parolaları değiştirilecek.**
      ```bash
      keytool -storepasswd -keystore aricimap-upload.jks
      keytool -keypasswd  -keystore aricimap-upload.jks -alias aricimap-upload
      ```
      Yeni parolaları `ANDROID_KEYSTORE_PASSWORD` ve `ANDROID_KEY_PASSWORD` secret'larına yaz.
- [ ] **Keystore dosyası şifreli bir yedekte tutulacak.**
      Bu anahtar kaybolursa Play Console'dan tekrar upload key reset istemek gerekir.
      Play App Signing devrede olduğu için uygulama anahtarı Google'da durur, ama
      upload anahtarı sende olmalı.

Keystore'un kendisi (`aricimap-upload.jks`) şu anda Play Console'da bekleyen bir upload key reset isteğine bağlıdır. Onay gelmeden anahtarı değiştirme — yalnızca parolalarını döndür.

## Sertifika parmak izi

Play Console'a gönderilen upload sertifikasının SHA-256 değeri:

```
6E:60:DA:4C:C0:24:1F:A4:87:49:1D:F3:89:10:C7:68:34:D1:5D:F9:1C:14:74:19:2B:BE:C2:85:EB:9C:82:25
```

Play Console → App signing ekranındaki değer bununla eşleşmelidir. Eşleşmiyorsa yüklenen AAB reddedilir.

## Sızıntı olursa

1. İlgili anahtarı hemen iptal et (Apple) veya parolasını döndür (Android).
2. GitHub Actions secret'larını güncelle.
3. Anahtar bir commit'e girdiyse commit'i silmek yetmez — anahtarı iptal et.
