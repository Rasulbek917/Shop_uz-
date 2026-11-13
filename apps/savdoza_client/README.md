# Savdoza Android va Windows

Flutter bilan yozilgan alohida native ilova. Backend — mavjud Savdoza Next.js loyihasi. Serverga HTTPS orqali ulanadi. Sessiya operativ xotirada saqlanadi, ilova yopilganda qayta login talab qilinadi.

Ekranlar: login, dashboard, mahsulotlar, shtrix-kod orqali qidiruv (klaviatura/USB skaner), POS savati, naqd/karta to‘lovi, chek ko‘rish, tarif holati va to‘lov so‘rovi. Kamera skaneri, printer, offline savdo va superadminning arizalarni tasdiqlash ekranlari hali qo‘shilmagan. Backend obuna va rolni har so‘rovda tekshiradi.

## Android

Flutter SDK va Android SDK kerak.

```sh
flutter pub get
flutter build apk --debug
```

Sinov APK fayli `build/app/outputs/flutter-apk/app-debug.apk`. Saytda e’lon qilish uchun uni loyihaning `public/releases/savdoza-android.apk` manziliga nusxalang. Production tarqatish uchun o‘zingizning signing keystore kalitingizni sozlab release build yarating. Generatsiya qilingan release sozlamasidagi debug imzosini production uchun ishlatmang.

## Windows

Windows kompyuterda Flutter va Visual Studio C++ Desktop workload kerak. PowerShell’da:

```powershell
.\build-windows.ps1
```

Natija `public/releases/savdoza-windows.zip`. Uning ichida `Savdoza.exe`, kerakli DLL fayllari va `data` papkasi bo‘ladi. Saytning `/download` sahifasi mavjud fayllarni avtomatik ko‘rsatadi.

Ilovadagi Server manziliga o‘zingizning HTTPS domeningizni kiriting. Telefonning localhost manzili telefonning o‘ziga tegishli. Hisoblar, savdo va tariflar barcha qurilmalarda bitta backend orqali yuritiladi.
