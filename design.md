# Sleep Rise — Uygulama Tasarım Sistemi

Bu dosya, tüm UI çalışmalarının takip edeceği bağlayıcı tasarım kurallarını içerir. Ayrıntılı yönlendirme için `ideas.md` dosyasındaki **Dawn Instrument** yaklaşımı esas alınır.

## Token'lar

| Kategori | Karar |
|---|---|
| Tipografi | Sistem font stack: SF Pro Display / SF Pro Text öncelikli. Sadece Regular ve Semibold ana ağırlıklar. Metriklerde tabular numerals. |
| Spacing | 4 px taban. Kullanılan aralıklar: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. |
| Renk | `background`, `surface`, `surface-soft`, `border`, `ink`, `muted`, `brand`, `brand-soft`, `night`, `night-soft`, `success`, `warning`, `destructive`. Bileşende hex kullanılmaz. |
| Radius | Ana yüzeyler 20 px; küçük kontroller 14 px; kapsül etiketler 999 px. Bu istisnalar hiyerarşi içindir. |
| Gölge | `shadow-card` ve `shadow-float` dışında gölge yok. |
| İkon | Sadece Lucide; 1.75 px çizgi ağırlığı hedeflenir. |
| Etkileşim | Kontrollerde focus-visible halkası, `:active` için 0.97 ölçek, 160 ms geri bildirim. |

## Erişilebilirlik ve platform hissi

Minimum etkileşim alanı 44 px'tir. Tüm kontrollerde anlamlı `aria-label` bulunur; klavye odağı görünürdür. Renk, tek başına durum göstergesi değildir. Hareketler 300 ms altında kalır ve `prefers-reduced-motion` ile azaltılır.

## İçerik hiyerarşisi

1. Son gecenin hikâyesi ve uyku skoru.
2. Bugün için tek uygulanabilir aksiyon.
3. Gelişim verileri ve ikincil içgörüler.

## Yasaklı varsayılanlar

Gerekçesiz mor-mavi gradyan, neon parlama, farklı ikon aileleri, yoğun 3-kart şablonları, rastgele köşe yarıçapları ve hard-coded renk değerleri kullanılmaz.
