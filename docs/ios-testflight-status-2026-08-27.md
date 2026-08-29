# ARICIMAP iOS/TestFlight durumu — 27 Ağustos 2026

## Apple hesabı ve uygulama

Apple Developer hesabında giriş başarılıdır. Team ID `9RFZP8QY57` olarak görüldü. ARICIMAP App ID’si mevcut ve doğru bundle identifier `com.arcadianstore.aricimap` ile kayıtlıdır. App Store Connect uygulama kaydı ARICIMAP, app ID `6804205800` olarak görüldü.

## App Store Connect

ARICIMAP TestFlight ekranında şu an **No Builds** görünmektedir. Henüz TestFlight’a yüklenmiş bir build bulunmamaktadır.

App Store Connect API ekranında mevcut beş App Manager anahtarına ek olarak `ARICIMAP GitHub Actions` isimli yeni Team API key oluşturuldu. Yeni key ID `3DM2AQLFZW` ve Issuer ID `dd6c3ffd-4bdc-4cbf-aeca-17298cb5b199` olarak görüldü. Yeni key’in tek seferlik Download bağlantısı tetiklendi; `.p8` dosyasının İndirilenler klasörüne inmesi beklenmektedir.

## GitHub workflow

Özel GitHub repository `ali5921592-lang/aricimap` içinde `iOS TestFlight` workflow’u aktif durumdadır. Workflow `macos-14` runner kullanır; web build, Capacitor iOS sync, Apple Distribution `.p12` import, App Store Connect provisioning profile indirme, Xcode archive/export ve TestFlight upload adımlarını içerir. GitHub’da workflow için henüz run bulunmamaktadır.

## Eksik kalan Apple materyalleri

Workflow’u çalıştırmak için yeni API key `.p8` dosyası yanında Apple Distribution `.p12` sertifikası ve parolası gereklidir. Provisioning profile workflow tarafından App Store Connect API ile indirilecektir; bundle ID ve Team ID doğrulanmıştır.

> Güvenlik notu: `.p8`, `.p12`, parolalar ve GitHub Actions secret değerleri kullanıcıya açık metin olarak paylaşılmamalı ve repository’ye commit edilmemelidir.
