# Savdoza native Android

Flutter ekranlari mavjud HTTPS backend API bilan ishlaydi. Dashboard, POS, mahsulotlar, kategoriyalar, ombor, kirim, mijozlar, nasiya, qaytarishlar, cheklar, hisobotlar, Pro/Max, xodimlar, yetkazib beruvchilar, amallar jurnali, sozlamalar va superadmin ekranlari bor.

## Offline va sinxronlash

Birinchi login va katalog yuklash online bajariladi. Android sessiya, katalog va savdo navbatini Android Keystore AES-GCM orqali shifrlab, AtomicFile bilan saqlaydi. Offline savdoda mahalliy qoldiq rezerv qilinadi. Har savdoning o‘zgarmaydigan `MOB-…` identifikatori bor. Server takroriy yuborishda bitta savdoni qaytaradi.

Android WorkManager tarmoq qaytganda va davriy tekshiruvlarda yuboradi. Android energiya va fon cheklovlari sabab vaqtni OS belgilaydi. Ilova ochilganda ham sinxronlash so‘raladi. API sessiya, obuna, qoldiq va summani tekshiradi. Konfliktli savdo telefonda saqlanadi va Sinxronlash ekranida ko‘rinadi. Ro‘yxatdan o‘tish, bank to‘lovi va boshqaruvdagi tahrirlar online ishlaydi.

POS’da savdodan oldin smena ochiladi. Smenani yopishdan oldin telefonda yoki kompyuterda navbatda turgan savdolarni sinxronlash kerak. Prechek savatni to‘lovdan oldin ko‘rsatadi; pul olmaydi va savdoni saqlamaydi.

Chek Flutter’da chiziladi. PNG saqlash fayl oynasi orqali, chop etish Android PrintManager yoki Windows printer oynasi orqali amalga oshiriladi. Chek 58 mm kenglikda chop etishga moslangan. Offline QR bir xil havolani saqlaydi. Serverga yuborilgach shu havola yakuniy chekni ochadi.

## Yig‘ish va tekshirish

```sh
flutter pub get
flutter analyze --no-fatal-infos
flutter test
flutter build apk --release --dart-define=API_URL=https://shop.aminboyevrasulbek.uz
```

GitHub Actions backend va Flutter testlarini bajarib, optimallashtirilgan preview APK’ni `android-latest` release’ga chiqaradi. Preview signing key CI cache’da keyingi buildlar uchun saqlanadi. Production tarqatish uchun alohida release keystore kerak.

Android uchun doimiy shifrlangan saqlash, fon sinxronlash, kamera, fayl saqlash va printer integratsiyalari yozilgan. Boshqa platformalarda platformaga bog‘liq funksiyalar alohida integratsiya talab qiladi.
