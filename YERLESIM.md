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

## Bu sürümde olmayan

- Anlık bildirim (push).
- Parola sıfırlama.
- Girişte deneme sınırı.
- Yöneticinin kullanıcı listesi / bölge değiştirme ekranı.
- site/privacy.html hâlâ "veriler cihazdan çıkmaz" diyor; ARTIK DOĞRU DEĞİL.
