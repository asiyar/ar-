# ARICIMAP

**ARICIMAP**, arıcıların arılık konumlarını, koloni durumlarını, saha denetimlerini ve sezon görevlerini tek bir profesyonel çalışma alanında yönetmesi için tasarlanmış bir saha operasyon uygulamasıdır.

## Öne çıkan deneyimler

| Alan | Mevcut kapsam |
|---|---|
| Hesap ve roller | Telefon + parola ile hesap; arıcı, personel ve yönetici rolleri sunucu tarafında yetkilendirilir. |
| Arılık haritası | Konuma dayalı arılık seçimi, il/ilçe sınırları ve harita üzerinden nokta seçimi. |
| Saha denetimi ve defter | Ziyaret kaydı, saha notu, konaklama talebi ve denetim izi. |
| Konum paylaşımı | Açık rıza ile konum paylaşımı; onaylı personel yalnızca kendi bölgesindeki kayıtları görür. |
| Bildirimler | Uygulama içi mesaj kutusu; Android'de kilit ekranı bildirimi (FCM). |
| Field Atlas tasarım sistemi | Sedir yeşili kabuk, kireçtaşı zemin ve sınırlı amber aksan. |

## Geliştirme

Bu proje React, TypeScript ve Vite ile hazırlanmıştır.

```bash
pnpm install
pnpm dev
```

Kalite kontrolleri:

```bash
pnpm exec vitest run
pnpm check
pnpm build
```

## Mobil uygulama (iOS / Android)

Depo, Capacitor tabanlı yerel uygulama kabuğunu içerir:

- Arayüz `client/public` altındaki varlıklardan gelir ve uygulama paketinin içinde taşınır. Leaflet yerelden servis edilir; uzaktan kod yüklenmez.
- Sunucu `server/` altındadır: Express + PostgreSQL (Neon), Render üzerinde çalışır.
- `ios/` ve `android/` klasörleri hazırdır; derlemeler GitHub Actions ile üretilir.

Henüz **olmayan**: kamera tabanlı QR tarama ve iOS kilit ekranı bildirimi (APNs yetkisi ve anahtarı bekliyor). Bu nedenle mağaza metinlerinde QR/kamera vaadi kullanılmamalıdır.

## Mağaza yayını öncesi

- Yayın öncesi denetim listesi: [`docs/APP-STORE-ONCESI-DENETIM-2026-09-11.md`](docs/APP-STORE-ONCESI-DENETIM-2026-09-11.md)
- App Review notu ve demo hesap taslağı: [`docs/APP-REVIEW-NOTLARI.md`](docs/APP-REVIEW-NOTLARI.md)
- Yayın adımları: [`docs/YAYIN-ADIMLARI.md`](docs/YAYIN-ADIMLARI.md)

## Durum ve sınırlamalar

Uygulama hesap gerektirir ve saha kayıtlarını sunucudaki veritabanında saklar; gizlilik ve destek metinleri bu davranışa göre güncellenmiştir. Harita karoları OpenStreetMap, Esri ve CARTO üzerinden gelir; yayın öncesi lisanslı bir karo sağlayıcısına taşınması önerilir.
