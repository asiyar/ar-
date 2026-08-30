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

YENİ olanlar depoda yok. GitHub'da "Add file → Create new file" ile oluştur,
dosya adı kutusuna klasörüyle birlikte yaz: örneğin server/content.ts

## Yükleme sonrası sıra

1. Deploy bitsin.
2. YÖNETİCİ OLACAK KİŞİ İLK KAYDI YAPSIN — ilk kayıt olan kurucu yönetici olur.
3. Yönetici → Yönetim → "İlçe sınırları" → Yükle.
   Bu adım atlanırsa hiçbir konum ilçeye atanamaz; bildirimler personele gitmez.
4. Personel adayları kayıt olup Hesap sekmesinden kurum bilgileriyle başvurur.
5. Yönetici başvuruyu onaylarken sorumlu olacağı bölgeyi seçer.

## Harita

- Leaflet uygulama paketinin içinden yüklenir (dist/public/vendor/leaflet).
  CDN'e bağımlı değildir; internetsizken karolar gelmez ama uygulama çökmez.
- İşaret renkleri: kırmızı = tespit edilmedi, yeşil = gidildi işaretlendi.
- Kaydedilmemiş seçim ayrı bir işaretle gösterilir.
- Kap boyutu geç oturursa (iframe, ekran dönmesi) harita kendini tazeler.

## Bu sürümde olmayan

- Anlık bildirim (push). Bildirimler uygulama içi mesaj kutusunda birikir.
- Parola sıfırlama.
- Girişte deneme sınırı (kaba kuvvet koruması).
- Yöneticinin kullanıcı listesi ve bölge değiştirme ekranı.
- site/privacy.html hâlâ "veriler cihazdan çıkmaz" diyor; ARTIK DOĞRU DEĞİL,
  mağaza başvurusundan önce güncellenmeli.
