# ARICIMAP Referans Deneyim Analizi

> Kaynak: Kullanıcının paylaştığı `html(1).html` dosyası. Bu not, arayüzün bire bir varlık veya kod kopyası olmadan; ürün yapısı, bilgi hiyerarşisi ve davranış kalıpları temel alınarak ARICIMAP’e uygulanması içindir.

## Referansın ürün omurgası

Referans ürün, “saha operasyonu” görünümünden önce **topluluk konum koordinasyonu** fikrini anlatır. İlk bakışta kullanıcıya Diyarbakır genelindeki arılıkların gerçek konumla, yalnızca açık rıza veya manuel harita seçimiyle kaydedildiğini söyler. Harita ekranın ana işlevsel nesnesidir; diğer tüm kayıtlar, denetimler ve yönetim araçları bu harita bağlamına bağlıdır.

| Katman | Referanstaki uygulama | ARICIMAP’te korunacak karşılık |
|---|---|---|
| Sol navigasyon | Konum ve saha, yönetim, admin olarak üç bölümlü sabit menü | Aynı üç katman; gereksiz görev/rota merkezli menüler çıkarılacak. |
| Üst alan | İl-geneli bağlam, rol seçici, bildirim, kullanıcı kimliği | “Diyarbakır İli · topluluk saha görünümü”, rol ve bildirim merkezi. |
| Durum bandı | Kayıt sayısı ve gerçek konum ilkesi | Arılık kaydı / konum paylaşımı açıklaması ve “Arılık kaydet” çağrısı. |
| Rol girişleri | Yetiştirici, personel ve yönetici için ayrı başlangıç kartları | Üç kullanıcı rolüne yönelik net erişim kartları. |
| Ana içerik | Gerçek OpenStreetMap + seçili arılık bağlam paneli | Harita merkezli içerik, seçilen kaydın sağ ayrıntı kartı. |
| Alt alan | Konum paylaşımları, saha kayıtları, arılık listesi | Aynı bilgi mimarisi; boş durumlar ve CSV/denetim aksiyonları. |
| Kayıt akışları | Arılık kaydı, denetim, açık rızalı konum paylaşımı modalları | Form doğrulama, konum kaynağı ve açık rıza bağlamı. |

## Görsel dil

Referans **koyu orman yeşili + bal amberi + krem zemin** üçlüsünü kullanır. Sol navigasyon sakin, uygulama yüzeyleri ince kenarlı ve az gölgeli; köşe yarıçapları orta ölçülüdür. Bal amberi yalnızca aktif navigasyon, birincil aksiyon ve öncelik vurgusu için kullanılır. Büyük kahraman fotoğrafı, rota kartı ve koloni sağlık skorları gibi ürün anlatısını farklı yöne çeken öğeler ana sayfada bulunmaz.

## Yeniden tasarım kararı

ARICIMAP, referansa yaklaşırken şu ilkeler uygulanacaktır: Harita birincil odak olacak; üst bölümde durum bandı ve rol kartları kullanılacak; sağ tarafta seçili arılık bağlamı yer alacak; konum paylaşımı rıza metniyle açıkça ayrıştırılacak; faaliyet, arılık listesi ve yerel paylaşım kayıtları altta gösterilecek. Mevcut ürünün “bugünün misyonu”, fotoğraflı rota ve koloni nabzı yüzeyleri ana ekrandan kaldırılacak veya referanstaki yönetim/denetim bağlamına dönüştürülecektir.

## Canlı doğrulama

Yenilenen uygulama masaüstü önizlemede kontrol edildi. Harita SDK’sı yüklendikten sonra Diyarbakır çevresindeki gerçek Google Maps katmanı, harita kontrolleri ve referanstaki harita + sağ bağlam paneli oranına yakın iki sütunlu içerik düzeni görünür hâle geldi.

Canlı akışta “Arılık kaydet” çağrısı açıldı; yeni modalda arılık adı, arıcı adı, kovan sayısı, yerleşim ilişkisi ve “haritada seç” kontrolü doğrulandı. Bu, referanstaki gerçek konumla kayıt prensibinin React sürümünde de korunduğunu gösterir.
