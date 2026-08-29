# ARICIMAP — Mobil Mağaza Yayın Hazırlığı

> Bu doküman, ARICIMAP’in mevcut web prototipinden iOS ve Android mağazalarında yayınlanabilir bir yerel uygulamaya geçişi için ürün ve uyumluluk kontrol listesidir. Bu aşamada mağaza hesabına veya kullanıcı verisine dokunulmamıştır.

## Ürün kimliği

| Alan | Önerilen değer | Açıklama |
|---|---|---|
| Görünen ad | **ARICIMAP** | 30 karakter altındaki, doğrudan ürünü anlatan ad. |
| Konumlandırma | Arıcı saha ve arılık operasyon yönetimi | Harita, kovan denetimi, görev ve QR akışı. |
| İlk sürüm | 1.0.0 | TestFlight / internal test sonrası üretim sürümü. |
| iOS kategori | Productivity | Kullanıcının saha iş akışını düzenleyen araç yapısına uygun öneri. |
| Android kategori | Productivity | Play Store listelemesinde karşılığı. |
| Yerel teknoloji | Expo / React Native | Kamera, GPS, offline taslak, push bildirimleri ve QR tarama için. |

## Yerel uygulamada planlanan izinler ve veri envanteri

ARICIMAP’in yerel sürümü için izinler yalnızca kullanıcı eylemiyle ve özelliği çalıştırmak için istenmelidir. Gerçek uygulama kullanıma alınmadan önce bu envanter, kullanılan SDK’lar ve sunucu davranışıyla tekrar doğrulanacaktır.

| Özellik | İzin veya veri | Amaç | Mağaza açıklaması etkisi |
|---|---|---|---|
| QR ile kovan açma | Kamera | Kullanıcının kendi kovan etiketini taraması | Kamera kullanım açıklaması; fotoğraf saklanmıyorsa bu açıkça belirtilmeli. |
| Arılık konumu | Hassas konum, kullanıcının onayıyla | Arılık işaretleme, rota ve saha doğrulaması | Apple App Privacy ve Google Data safety içinde konum verisi beyanı gerekir. |
| Denetim ve görevler | Kullanıcının girdiği saha notları | Arılık operasyon geçmişi ve ekip iş akışı | Kullanıcı içeriği; saklama, şifreleme ve silme politikasına bağlanmalı. |
| Kullanıcı hesabı | Ad, e-posta, kullanıcı kimliği | Ekip erişimi ve cihazlar arası eşitleme | Hesap silme ve veri dışa aktarma akışı gerekir. |
| Bildirimler | Cihaz bildirimi | Yaklaşan besleme, denetim ve sezon görevleri | Bildirim izni, kullanıcı kontrolü ve abonelik tercihleri. |

Apple, uygulamanın ve üçüncü taraf kodların topladığı verileri App Store Connect’te beyan etmeyi ister; beyanların güncel tutulmasından geliştirici sorumludur. [1] Google Play de tüm geliştiricilerin uygulama ve SDK veri uygulamalarını Data safety formunda doğru açıklamasını ister. [2]

## Gerekli mağaza varlıkları

| Varlık | Durum | Sahipten gerekli bilgi |
|---|---|---|
| 1024×1024 iOS uygulama ikonu | Tasarım yönü hazır | Marka sahibinin onayı ve son ikonu. |
| Android adaptive icon | Tasarım yönü hazır | Son foreground/background seçimi. |
| iOS ve Android ekran görüntüleri | Yerel sürüm yapıldıktan sonra üretilecek | Gerçek kamera, harita ve denetim akışlarını gösteren cihaz ekranları. |
| Gizlilik politikası URL’si | **Eksik** | Kamuya açık alan adı ve politikayı yayınlayacak tüzel/gerçek kişi. |
| Destek URL’si ve e-posta | **Eksik** | Müşteri destek kanalı. |
| Store metinleri | Taslak aşamasında | Şirket adı, fiyatlandırma ve abonelik modeli. |

Apple, yeni uygulama ve güncellemelerde gizlilik uygulamalarının açıklanmasını ve erişilebilir bir gizlilik politikası URL’sini ister. [1] Apple App Review ayrıca işlevsel uygulama, doğru metadata, inceleme erişimi ve gerekiyorsa demo hesabı/sample QR kodu ister. [3]

## Yayın sırası

| Sıra | iOS | Android |
|---|---|---|
| 1 | Apple Developer üyeliği ve App Store Connect kaydı | Google Play Developer hesabı ve Play Console uygulama kaydı |
| 2 | Benzersiz bundle ID, imzalama ve TestFlight build | Benzersiz paket adı, Play App Signing ve AAB build |
| 3 | TestFlight ile saha testleri; inceleme için demo hesap/örnek QR | Internal / closed test; yeni kişisel hesaplarda ek test koşullarını doğrulama |
| 4 | Gizlilik bilgisi, yaş derecelendirmesi, ekran görüntüleri ve App Review Notes | Store listing, Data safety, içerik beyanları ve ekran görüntüleri |
| 5 | App Review gönderimi | Production rollout veya aşamalı yayın |

Google Play, paket adlarının benzersiz ve kalıcı olduğunu; dağıtım için Android App Bundle (AAB) akışını kullandığını belirtir. [4] Yeni kişisel Play geliştirici hesaplarında üretim erişiminden önce ek test şartları olabilir. [4] Apple, App Review’a gönderilen build’in tamamlanmış, cihazda test edilmiş ve metadata’sının doğru olmasını bekler. [3]

## Mağaza yayınını başlatmak için sahipten gerekenler

| Gerekli bilgi veya erişim | Neden gerekli |
|---|---|
| Apple Developer / App Store Connect yetkisi | iOS imzalama, TestFlight ve App Review gönderimi. |
| Google Play Console yetkisi | Android package kaydı, AAB yükleme ve yayın kanalları. |
| Uygulama sahibi şirket veya kişi adı | Store geliştirici kimliği ve yasal metinler. |
| Kamuya açık destek e-postası ve gizlilik politikası alan adı | Store listing ve kullanıcı destek yükümlülüğü. |
| Benzersiz bundle/package prefix tercihi | `com.<sahip>.aricimap` kalıcı tanımlayıcısı için. |
| Ekip test listesi | TestFlight ve Play closed-test kullanıcısı. |

## Referanslar

[1]: https://developer.apple.com/app-store/app-privacy-details/ "Apple — App privacy details"

[2]: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en "Google Play — Data safety section"

[3]: https://developer.apple.com/app-store/review/guidelines/ "Apple — App Review Guidelines"

[4]: https://support.google.com/googleplay/android-developer/answer/9859152?hl=en "Google Play — Create and set up your app"
