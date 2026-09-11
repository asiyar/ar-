# ARICIMAP — App Review notu ve demo hesap hazırlığı

App Store Connect'te "App Review Information → Notes" alanına yapıştırılacak metin
ve inceleme öncesi hazırlanması gereken hesap bilgileri.

---

## 1. İnceleme öncesi yapılacak (tek seferlik)

Uygulama **giriş gerektirir**. Apple inceleyicisinin uygulamaya girebilmesi için
demo hesap önceden açılıp notlara yazılmalıdır.

1. Uygulamada (veya `https://ar-3q6i.onrender.com` adresinde) yeni bir hesap aç.
   - **Not:** Sunucuda ilk kaydolan kullanıcı otomatik olarak `yonetici` rolünü alır.
     Bu yüzden demo hesabı, üretimdeki gerçek yönetici hesabı **oluşturulmadan önce**
     veya ayrı bir temiz kurulumda oluştur.
2. Demo hesabın telefon numarası ve parolasını aşağıdaki şablona yaz.
3. Hesabın durumu `onayli` olmalı (arıcı rolü kayıt anında onaylı olur; personel
   rolü yönetici onayı bekler).
4. Mümkünse demo hesaba 2–3 örnek arılık kaydı ekle ki inceleyici boş ekranla
   karşılaşmasın.

| Alan | Değer |
|---|---|
| Demo telefon | `____________________` |
| Demo parola | `____________________` |
| Rol | arıcı (onaylı) |

> Ekran görüntüleri ve inceleme notları için kullanılacak cihaz: iPhone (uygulama
> iPhone'a sabitlenmiştir; iPad desteği kapalıdır).

---

## 2. App Review Notes (İngilizce + Türkçe)

### English

```
ARICIMAP is a field-operations app for beekeepers and agricultural field staff.

SIGN-IN: The app requires an account. Please use the demo account below.
  Phone: <DEMO_PHONE>
  Password: <DEMO_PASSWORD>

LOCATION: Location is requested only after the reviewer taps "GPS konumum" or
"Konumumu paylaş" inside the app. There is no background location tracking and
no location permission request at launch.

DATA STORAGE: Apiary records, field notes and voluntarily shared locations are
stored on our server (Express + PostgreSQL) so that the same account sees the
same data on any device. The privacy policy and support pages are linked from
the "Hesap" (Account) tab and are also available at:
  <PRIVACY_URL>
  <SUPPORT_URL>

ACCOUNT DELETION: Users can permanently delete their account and all related
data in-app: Hesap tab -> "Hesabımı kalıcı olarak sil".

NOTIFICATIONS: On Android the app registers a Firebase Cloud Messaging token for
lock-screen notifications. On iOS the app intentionally does not request
notification permission yet (APNs setup pending); in-app notification inbox is
used instead. No camera, photo library, microphone or tracking permission is
requested.

OFFLINE CONTENT: All app assets (HTML/CSS/JS, map library) are bundled inside the
app package. No remote code is loaded at runtime; only map tiles and API calls
require network access.
```

### Türkçe (aynı içerik)

```
ARICIMAP, arıcılar ve tarım saha personeli için bir saha operasyon uygulamasıdır.

GİRİŞ: Uygulama hesap gerektirir. Lütfen aşağıdaki demo hesabı kullanın.
  Telefon: <DEMO_TELEFON>
  Parola : <DEMO_PAROLA>

KONUM: Konum yalnızca inceleyici uygulama içindeki "GPS konumum" veya
"Konumumu paylaş" düğmesine bastığında istenir. Arka planda konum takibi yoktur,
açılışta konum izni istenmez.

VERİ SAKLAMA: Arılık kayıtları, saha notları ve gönüllü paylaşılan konumlar
sunucumuzda (Express + PostgreSQL) saklanır; böylece aynı hesap her cihazda aynı
veriyi görür. Gizlilik ve destek sayfaları "Hesap" sekmesinden ve şu adreslerden
açılır: <GİZLİLİK_URL> , <DESTEK_URL>

HESAP SİLME: Kullanıcı hesabını ve tüm verilerini uygulama içinden kalıcı olarak
silebilir: Hesap sekmesi -> "Hesabımı kalıcı olarak sil".

BİLDİRİM: Android'de Firebase Cloud Messaging ile kilit ekranı bildirimi gönderilir.
iOS'ta APNs kurulumu tamamlanmadığı için bildirim izni istenmez; uygulama içi mesaj
kutusu kullanılır. Kamera, fotoğraf galerisi, mikrofon ve izleme izni istenmez.

ÇEVRİMDIŞI İÇERİK: Tüm arayüz dosyaları uygulama paketinin içindedir; çalışma
anında uzaktan kod yüklenmez. Yalnızca harita karoları ve API çağrıları için
internet gerekir.
```

---

## 3. Mağaza metninde kullanılmaması gerekenler

Uygulamada **kamera ve QR tarama yoktur**. Mağaza açıklaması, anahtar kelimeler ve
ekran görüntüsü alt metinlerinde şu ifadeler kullanılmamalıdır:

- "QR ile kovan açma", "barkod/karekod tarama"
- "kamera ile hasat kaydı"
- "iOS'ta kilit ekranı bildirimi" (iOS push henüz aktif değil)

Aksi halde Apple, Metadata 2.3.1 (doğru olmayan açıklama) kapsamında red verebilir.
