# ARICIMAP — dosya yerleşimi

| Dosya | Klasör | Durum |
|---|---|---|
| accountStore.ts | server/ | üzerine yaz |
| accountRoutes.ts | server/ | üzerine yaz |
| accountStore.test.ts | server/ | üzerine yaz |
| index.ts | server/ | üzerine yaz |
| districts.ts | server/ | YENİ |
| districts.test.ts | server/ | YENİ |
| notifications.ts | server/ | YENİ |
| staffApplications.ts | server/ | YENİ |
| fieldwork.ts | server/ | YENİ |
| fieldwork.test.ts | server/ | YENİ |
| content.ts | server/ | YENİ |
| content.test.ts | server/ | YENİ |
| stayRequests.ts | server/ | YENİ |
| aricimap-app.html | client/public/ | YENİ |
| aricimap-app.js | client/public/ | YENİ |
| aricimap-server-client.js | client/public/ | üzerine yaz |
| Home.tsx | client/src/pages/ | üzerine yaz |
| package.json | kök | üzerine yaz |
| pnpm-lock.yaml | kök | üzerine yaz |
| render.yaml | kök | üzerine yaz |

## APK için ZORUNLU ayar

aricimap-server-client.js içinde sunucu adresi sabit yazılıdır:

    const REMOTE_API = "https://ar-3q6i.onrender.com";

Render adresin farklıysa BU SATIRI değiştir. APK içinde göreli adres
telefonun kendi içine gider, sunucuya ulaşmaz. Tarayıcıda bu satır kullanılmaz.

## Yükleme sonrası sıra

1. Deploy bitsin.
2. Yönetici olacak kişi İLK KAYDI yapsın (ilk kayıt = kurucu yönetici).
3. Yönetim → İlçe sınırları → çalışılacak illeri TEK TEK yükle.
   Yüklenmemiş ilde konum ilçeye atanamaz, bildirim personele gitmez.
4. Personel adayları Hesap sekmesinden il + ilçe seçip başvurur.
5. Yönetici onaylarken bölgeyi seçer; il, seçilen ilçeden türetilir.
6. APK'yı YENİDEN üret. Eski APK eski kodu taşır.

## Türkiye geneli

Uygulamada sabit il veya ilçe yoktur:
- Harita ülke görünümüyle açılır.
- 81 ilin herhangi biri için ilçe sınırı yüklenebilir.
- Duyurular üç kapsamda yayınlanır: Türkiye geneli / tek il / tek ilçe.
- Personel başvurusunda il ve ilçe listeden seçilir.
- Aynı adlı ilçeler farklı illerde olabildiği için bölge seçimi ili de taşır.

## Bu sürümde olmayan / sınırlar

- iOS'ta anlık bildirim (push): Android'de FCM çalışır, iOS'ta APNs kurulumu bekler.
- Kullanıcı parolasını e-posta/SMS ile kendisi sıfırlayamaz; kurtarma anahtarı veya yönetici gerekir.
- Girişte deneme sınırı (rate limit) yok.
- Kamera / QR tarama yok.
- Harita karoları henüz lisanslı bir sağlayıcıya taşınmadı (OSM/Esri/CARTO).

## 11 Eylül 2026 denetiminde yapılanlar

- `site/privacy.html` ve `client/public/privacy.html` artık gerçek veri akışını anlatıyor
  (hesap, sunucu veritabanı, konum paylaşımı, push jetonu). `site/support.html` ve yeni
  `client/public/support.html` aynı şekilde güncellendi.
- Uygulama içinden gizlilik ve destek metinleri okunabiliyor (Hesap sekmesi → Yasal ve destek).
- Kimlik doğrulamasız `/api/aricimap/state` uç noktası ve `server/stateStore.ts` kaldırıldı.
- Kökteki ölü dosya kopyaları, `server/stateStore.ts`, `server/stateStore.test.ts` ve
  `client/public/aricimap-reference.html` silindi.
- iOS: `ITSAppUsesNonExemptEncryption`, `arm64`, `CFBundleDevelopmentRegion = tr`,
  iPhone'a sabitlenmiş cihaz ailesi ve `PrivacyInfo.xcprivacy` eklendi.
- Detaylı liste ve kalan işler: `docs/APP-STORE-ONCESI-DENETIM-2026-09-11.md`.
