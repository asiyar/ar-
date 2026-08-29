# Sleep Rise — Tasarım Yönlendirmesi

## Üç Tasarım Yaklaşımı

| Tema adı | Çok kısa açıklama | Olasılık |
|---|---|---:|
| **Dawn Instrument** | Erken sabahın açık, temiz ışığını hassas bir uyku ölçüm aracının sakinliğiyle birleştirir. Verileri gösterişten uzak ama hissedilir derecede güven veren bir düzen içinde sunar. | 0.07 |
| **Nocturne Atelier** | Koyu indigo zeminler ve fırçalanmış metal ayrıntılarla gecenin ritüelini lüks bir kişisel bakım deneyimi gibi ele alır. | 0.03 |
| **Quiet Tactility** | Yumuşak mineral tonlar, dokunsal yüzeyler ve düzenli tipografiyle bir sağlık günlüğünün sakin, insanî hissini taşır. | 0.09 |

## Seçilen yaklaşım: Dawn Instrument

### Tasarım Hareketi

**Sessiz teknoloji / çağdaş sağlık editoryali.** iOS sağlıklı yaşam arayüzlerinin doğal netliğini, ölçüm cihazlarının dürüstlüğü ve sofistike dergi düzenlerinin nefes alan kompozisyonuyla birleştirir.

### Temel İlkeler

1. **Ritmik netlik:** Her sayısal veri, metin ve kontrol 4 px tabanlı bir aralık sistemi ile yerleşir; kullanıcı kendini ölçülen ve anlaşılır bir ritim içinde hisseder.
2. **Az ama anlamlı yükselti:** Yüzeyler düz sınırlarla değil, mineral arka plan üzerindeki hafif derinlik, ince kontur ve boşlukla ayrılır.
3. **Önce gece, sonra bugün:** Ana ekran son geceyi bir hikâye olarak anlatır; ardından bugünün tek net eylemine yönlendirir.
4. **Güvenli kişisellik:** Renk ve hareket dikkat çekmek için değil, uyku kalitesini ve ilerlemeyi hızlı kavratmak için kullanılır.

### Renk Felsefesi

Nötr **porcelain** zemin, arayüzü klinik değil sakin kılar. Koyu **ink** metin netlik verir. Kendine ait **dawn coral** aksanı, uyku sonrası enerji ve uyanış hissini taşır; bu renk yalnızca ana eylem, önemli ilerleme ve seçili durumda görünür. Soluk lavanta-blue tonu veri görselleştirmelerinde ikincil bir gece imzası olarak kalır; baskın gradyan kullanılmaz.

### Yerleşim Paradigması

Masaüstünde içerik orta hizalı kart yığını değil, sabit bir sol gezinti sütunu ile iki ritimli çalışma alanı olarak bölünür: geniş “son gece” anlatısı ve dar “bugün” komut paneli. Mobilde bu alanlar zaman çizelgesi gibi üst üste akar; tab bar beşten az öğe içerir.

### İmza Unsurları

1. **Uyku yayı:** Geceyi yatay, yumuşak ama ölçülü bir uyku aşaması grafiği olarak gösteren ana görsel.
2. **Dawn band:** Başlık alanları ve kritik durumlarda görünen ince, sıcak mercan ışık şeridi.
3. **Saat halkası:** Hedefe yaklaşmayı gösteren tamir edilmiş/temiz bir halka; asla dekoratif neon değildir.

### Etkileşim Felsefesi

Etkileşimler küçük ama belirgindir. Butonlar basıldığında 0.97 ölçeğine iner, grafik bölümleri seçildiğinde yalnızca ilgili bilgiyi açar, hedef tamamlama gibi anlamlı eylemler görsel onayla desteklenir. Tüm kontroller 44 px minimum dokunma alanını hedefler.

### Animasyon

Girişler 180–240 ms aralığında `transform` ve `opacity` kullanır; uyku grafiği sayfa açılışında bir kez sakin biçimde çizilir. Yüksek sıklıklı kontrollerde animasyon minimaldir. Açılır katmanlar kaynağından açılır, CTA basım tepkileri 160 ms altında kalır. `prefers-reduced-motion` etkin kullanıcılar için dekoratif hareket kapatılır.

### Tipografi Sistemi

Uygulama içi metin **SF Pro Display / SF Pro Text** sistem sırasıyla çalışır; yalnızca iki ana ağırlık kullanılır: Regular ve Semibold. Metrikler tabular rakamlarla gösterilir. Başlıklar kısa, yoğun ve sol hizalı; açıklamalar daha düşük kontrastta, 16 px civarında rahat satır aralığıyla görünür.

### Marka Özü

**Sleep Rise, daha dinç bir sabah için geceni anlaşılır bir ritme dönüştüren kişisel uyku rehberidir.**

Kişilik: **sakin, hassas, güven veren.**

### Marka Sesi

Başlıklar yargılamayan, belirli ve nazik biçimde yol gösterir. CTA'lar komut vermek yerine küçük bir sonraki adımı netleştirir.

> “Gecenin ritmi daha erken sakinleşti.”

> “Bu akşam için yatış saatini ayarla.”

### Wordmark ve Logo

Wordmark, iki yumuşak yatay yay arasındaki yükselen küçük bir nokta fikrinden oluşur; yazı kullanılmadan tanınabilir, maske/uyku ikonografisine kaçmayan soyut bir “geceden sabaha” işaretidir. Header ve favicon içinde görünür boyutta kullanılacaktır.

### İmza Marka Rengi

**Dawn Coral — `#E8755F`**

## Style Decisions

- Tasarım tercihlerinde “Bu karar Dawn Instrument yaklaşımını güçlendiriyor mu, zayıflatıyor mu?” sorusu kullanılacaktır.
- Varsayılan mor-mavi gradyan, parlak glow, rastgele radius, farklı ikon stilleri ve yoğun kart ızgaraları kullanılmayacaktır.
- Görsel ağırlık, tek bir kaliteli uyku analizi grafiğinde ve dengeli boşlukta toplanacaktır.
- Uyku verisi, sıradan çok renkli aşama grafiği yerine yatay ve sürekli bir **uyku yayı/ritmi** olarak sunulacaktır. Gece verisinde soluk lavanta-blue, seçili durum ve ilerlemede yalnızca Dawn Coral kullanılacaktır.
- Sleep Rise işareti, küçük ölçekte dahi iki yumuşak yay ile yükselen nokta fikrini koruyan görünür bir imza olarak kullanılacaktır.
- Görseller sabah toparlanması ve açıklık hissini destekleyecek; karanlık spa-lüksü atmosferi ana görsel dil hâline gelmeyecektir.
