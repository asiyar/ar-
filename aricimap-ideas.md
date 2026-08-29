# ARICIMAP — Görsel Yönlendirme

## Alternatif Tasarım Yaklaşımları

| Tema adı | Çok kısa açıklama | Olasılık |
|---|---|---:|
| **Field Intelligence** | Toprak, harita ve ölçüm dilini sade bir saha operasyon arayüzünde birleştirir; kritik işleri ve riskleri ilk bakışta ayırır. | 0.07 |
| **Honey Ledger** | Bal amberi, dokulu kâğıt ve üretim defteri estetiğiyle küçük ölçekli arıcılar için sıcak bir kayıt deneyimi sunar. | 0.03 |
| **Hive Atlas** | Kovan ağını harita merkezli bir coğrafi analiz ürünü olarak ele alır; yüksek veri yoğunluğu ve katmanlı harita etkileşimleri kullanır. | 0.09 |

## Seçilen yaklaşım: Field Intelligence

### Tasarım Hareketi

**Saha enstrümanı / çağdaş tarım operasyonu.** ARICIMAP, geleneksel bir arıcılık defteri gibi değil; araziye çıkmadan önce neye bakılacağını, sahadayken hangi kaydın önemli olduğunu ve gün sonunda hangi riskin beklediğini gösteren güvenilir bir operasyon aracı olarak hissettirmelidir.

### Renk Felsefesi

Açık **chalk** zemin, okunabilirlik ve yoğun saha ışığında rahat kullanım sağlar. Koyu **cedar green** navigasyon ve ana veri çerçevesidir. **Honey amber** yalnızca ana aksiyon, seçili durum, uyarı önceliği ve ilerleme için kullanılır. Saha durumları bal amberi ile yarışmaz: sağlık ve konum verileri yumuşak sedir/taş tonlarında kalır.

### Yerleşim Paradigması

Masaüstünde sabit sol navigasyon, geniş “bugün saha odağı” alanı ve sağda görev/risk sütunu bulunur. Harita ve arılık listesi aynı karar bağlamında yaşar. Mobilde önce kritik işler, sonra arılık haritası ve hızlı denetim akışı gelir; yüzen ana aksiyon her zaman 44 px üzerinde dokunma alanına sahiptir.

### İmza Unsurları

1. **Peten pusulası:** Harita, koordinat ve saha güvenini temsil eden ince altıgen/pusula işareti.
2. **Koloni nabzı:** Kovan sağlığı, denetim tarihi ve Varroa riskini tek satırda okuyatan yatay ölçüm şeridi.
3. **Saha kartuşu:** Arılık adı, konum doğruluğu ve yaklaşan görevin gerçek iş emri gibi göründüğü kompakt kart.

### Tipografi ve Etkileşim

Sistem fontu kullanılır; yalnızca Regular ve Semibold ağırlıklarıyla güçlü saha okunabilirliği sağlanır. Tüm sayaçlarda tabular rakam, her kontrolde focus/pressed/loading geri bildirimi ve 4 px tabanlı spacing uygulanır. QR tarama, hızlı denetim ve görev tamamlama tek birincil eylem çevresinde kurgulanır.

### Marka Özü

**ARICIMAP, arılık operasyonunu konumdan karara dönüştüren saha çalışma alanıdır.**

Kişilik: **duru, dayanıklı, güvenilir.**

### Kaçınılacak Varsayılanlar

Parlak sarı her yerde kullanılmaz; kovan/arı çizimi ana logo yerine geçmez. Birden çok gölge, çoklu ikon aileleri, rastgele radius’lar, mor-mavi gradyanlar ve dikkat dağıtan “tarım teması” süsleri kullanılmaz.
