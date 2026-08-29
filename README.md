# ARICIMAP

**ARICIMAP**, arıcıların arılık konumlarını, koloni durumlarını, saha denetimlerini ve sezon görevlerini tek bir profesyonel çalışma alanında yönetmesi için tasarlanmış bir saha operasyon uygulamasıdır.

## Öne çıkan deneyimler

| Alan | Mevcut kapsam |
|---|---|
| Saha operasyon merkezi | Öncelikli işler, risk görünümü, rota ve arılık seçimi. |
| Arılık haritası | Konuma dayalı arılık seçimi ve koloni sağlık bağlamı. |
| Hızlı denetim | Ana arı, koloni gücü ve saha notu için geri bildirimli kayıt akışı. |
| QR erişimi | Doğru kovana hızlı geçiş için yerel uygulamaya taşınacak tarama akışı. |
| Field Atlas tasarım sistemi | Belgesel saha fotoğrafçılığı, sakin hareket, sedir yeşili ve sınırlı amber aksan. |

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

## Mobil yayın planı

Web prototipi, Expo/React Native ile yerel iOS ve Android uygulamasına taşınacak şekilde tasarlanmıştır. Kamera tabanlı QR tarama, hassas konum, çevrimdışı taslaklar ve push bildirimleri yerel sürümün sonraki aşamasıdır.

Detaylı mağaza yayın kontrol listesi için [`docs/STORE-RELEASE-READINESS.md`](docs/STORE-RELEASE-READINESS.md) dosyasına bakın.

## Durum ve sınırlamalar

Bu depo, etkileşimli ürün prototipini içerir. Harita konumları, görevler ve koloni metrikleri gösterim amaçlıdır; üretim için kullanıcı hesabı, veri modeli, yetki kontrolleri, gerçek harita/QR cihaz entegrasyonu ve gizlilik politikası tamamlanmalıdır.
