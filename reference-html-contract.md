# ARICIMAP Sıfırdan Referans HTML Sözleşmesi

Bu sürüm, kullanıcının verdiği `html(1).html` dosyasını **kaynak uygulama** kabul eder. Önceki Field Atlas ve yorumlanmış harita arayüzleri kullanılmayacaktır.

| Sıra | Referans blok | Sıfırdan uygulanacak davranış |
|---:|---|---|
| 1 | Koyu yeşil sabit kenar çubuğu | Aynı marka, il bağlamı, üç navigasyon grubu, yerel demo sıfırlama. |
| 2 | Üst çubuk ve durum bandı | Diyarbakır bağlamı, rol seçimi, bildirim sayacı, gerçek konum ilkesi. |
| 3 | Rol kartları ve paylaşım paneli | Yetiştirici/personel/yönetici girişleri ve açık rızalı konum paylaşımı. |
| 4 | Sponsor alanı ve dört sayaç | Başlangıçta boş sponsor alanı, yalnızca gerçek kullanıcı işlemlerinden hesaplanan sayılar. |
| 5 | Leaflet + OpenStreetMap harita | Diyarbakır il kapsaması, harita/GPS ile gerçek nokta seçimi; başlangıçta sahte konum yok. |
| 6 | Sağ bağlam paneli | Seçili arılık yok boş durumu; seçilince durum, kovan, koordinat, kaynak ve aksiyonlar. |
| 7 | Paylaşım listesi, denetim, arılık listesi | Yerel demo durumundan türetilen kayıt listeleri ve CSV dışa aktarma. |
| 8 | Modallar | Arılık kaydı, denetim, açık rızalı konum paylaşımı, yayın hazırlığı, yönetim ve bildirim merkezi. |

Kabul ölçütü: İlk bakışta referans HTML ile aynı sayfa bölümleri, içerik sırası, renk sistemi ve harita odaklı bilgi mimarisi görülmelidir. Farklı bir operasyon panosu, fotoğraflı kahraman alanı veya yorumlanmış kart düzeni eklenmeyecektir.

## Tam navigasyon dökümü

| Grup | Referans öğe | React karşılığı |
|---|---|---|
| Konum ve saha | Arılık Haritası | Varsayılan harita çalışma alanı. |
| Konum ve saha | Konumumu Paylaş | Açık rıza + konum seçimi modalı. |
| Konum ve saha | Arılıklar | Arılık listesine kaydırma ve sayaç. |
| Konum ve saha | Arıcılar | Gerçek kişi verisi yokken bilgilendirme durumu. |
| Konum ve saha | Saha Denetimleri | Seçili arılıkla ilişkili denetim modalı. |
| Yönetim | Konum Hareketleri | Konum güncellemelerinden oluşan hareket kaydı. |
| Yönetim | Uyarılar | Bildirim merkezi ve okunma durumu. |
| Yönetim | Raporlar | Arılık CSV dışa aktarma. |
| ARICIMAP admin | Reklam Yönetimi | Yönetici rollü sponsor/reklam modalı. |
| ARICIMAP admin | Duyuru Yönetimi | Yönetici rollü duyuru modalı. |
| ARICIMAP admin | Yayın Hazırlığı | Mağaza geçiş kontrol modalı. |

## Tam modal ve akış dökümü

| Modal | Girdi / kontrol | Başarı davranışı |
|---|---|---|
| Arılık kaydı | Ad, arıcı, kovan, durum, yerleşim, not, GPS/harita noktası | Gerçek konumlu arılık, seçili bağlam ve aktivite kaydı oluşur. |
| Saha denetimi | Arılık, sahada sayılan kovan, tarih, not | Denetim kaydı ve beyan farkı varsa uyarı oluşur. |
| Konum paylaşımı | Ad, telefon, mevki, açık rıza, GPS/harita noktası | Gönüllü paylaşım listesi ve paylaşım işareti oluşur. |
| Yayın hazırlığı | Bilgilendirme ve onay | HTTPS, gizlilik, izin ve test gereksinimlerini gösterir. |
| Reklam / duyuru yönetimi | Yalnızca yönetici rolü | Sponsor alanı, duyuru ve bildirim verileri güncellenir. |
| Bildirim merkezi | Okuma işlemi | Operasyon ve duyuru kayıtları listelenir, sayaç güncellenir. |

## Sıfırdan kurulum doğrulaması

Uygulama ana yolu, kullanıcının gönderdiği kaynak HTML’i doğrudan açmaktadır. Canlı masaüstü oturumunda Leaflet/OpenStreetMap haritası, üç navigasyon grubu ve “Arılık kaydet” kontrolü görünür; bu kontrol açıldığında referanstaki arılık adı, arıcı adı, kovan sayısı, durum, yerleşim, harita/GPS seçimi ve not alanları bulunan kayıt modalı çalışır.

İframe belgesinde yapılan eksiksiz DOM denetiminde `map`, `stats`, `context`, `shareList`, `activityList`, `apiaryList`, `sponsorMount` ve `rolePanels` bloklarının tamamı bulundu. Aynı denetimde **3** navigasyon grubu, **12** navigasyon düğmesi, **6** modal ve aktif Leaflet harita katmanı doğrulandı. Masaüstü ile mobil ekran görüntüleri de kaynak HTML’in sırasıyla çok sütunlu ve tek sütunlu kırılımını doğrudan gösterdi.
