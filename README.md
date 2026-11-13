# Savdoza

Ko'p do'konli (SaaS) kassa va ombor boshqaruv tizimi: Next.js, Prisma, PostgreSQL.

## Ishga tushirish
1. `cp .env.example .env` va qiymatlarni to'ldiring (`JWT_SECRET` kamida 32 belgi: `openssl rand -hex 32`)
2. `npm install`
3. `npm run db:start` (mahalliy PostgreSQL kerak bo'lmasa) yoki o'z `DATABASE_URL` ni yozing
4. `npm run prisma:push` va `npm run prisma:seed`
5. `npm run dev`

## Kichik termal printerda chek chiqarish (58 mm / 80 mm)
**Brauzer orqali ("Standart Chop")**
1. Printerni kompyuterga o'rnating va uning drayverida qog'oz o'lchamini rulon qilib tanlang (58 mm yoki 80 mm).
2. Chek oynasida printerga mos 58 mm / 80 mm tugmasini tanlang, so'ng "Standart Chop".
3. Chop oynasida: **Margins = None**, **Scale = 100%**, **Headers and footers = o'chiq**.

**To'g'ridan-to'g'ri ("ESC/POS Termal")**: Chrome yoki Edge'da USB/Serial printer. Chekda QR kod ham chiqadi, kassa tortmasi faqat naqd to'lovda ochiladi.

## Xavfsizlik
- `.env` faylini hech qachon GitHub'ga yuklamang.
- Production'da `JWT_SECRET` va `INITIAL_SUPER_ADMIN_PASSWORD` majburiy.
- Seed paroli faqat test uchun, birinchi kirishdan keyin almashtiring.

## Kirishda "Server bilan bog'lanishda xatolik" chiqsa
1. `.env` fayli bormi va ichida `DATABASE_URL` hamda `JWT_SECRET` (kamida 32 belgi) yozilganmi?
2. `npx prisma generate` va `npm run prisma:push` ishlatilganmi? Test foydalanuvchilar uchun `npm run prisma:seed`.
3. PostgreSQL ishlayaptimi (`npm run db:start` yoki o'zingizning bazangiz)?
4. `.env` o'zgargach serverni (`npm run dev`) to'xtatib qayta ishga tushiring.

## Alohida lokal rejim
`npm run local` o‘zining PostgreSQL bazasini 55432-portda, saytni 3000-portda ochadi. Bu yangi lokal baza: mavjud onlayn ma’lumotlar unga ko‘chirilmaydi. Migratsiyalar avtomatik qo‘llanadi, superadmin yaratiladi. Login va lokal parol terminalda chiqadi. `.local-credentials.json` faylini ulashmang. Narx va rekvizitlarni superadminning Tarif sozlamalarida kiriting. Oddiy `npm run dev` esa `.env` dagi mavjud bazani ishlatadi.

## Tezcheck tarif to‘lovlari

Server `.env` faylida `TEZCHECK_API_TOKEN` (aps_…), `TEZCHECK_CASH_DESK_CODE` (cdk_…), `TEZCHECK_WEBHOOK_SECRET` va `APP_URL` (HTTPS domen) kerak. Token va webhook kalitini repozitoriyga joylamang.

`npx prisma generate` va `npx prisma migrate deploy` ni bajarib serverni qayta ishga tushiring. Tezcheck kabinetida `https://DOMEN/api/webhooks/tezcheck` endpointini qo‘shing va `payment.succeeded` hodisasini yoqing. Yaratishda berilgan webhook imzo kalitini `TEZCHECK_WEBHOOK_SECRET` ga saqlang.

Mijozga kassada yoqilgan usullar API orqali ko‘rsatiladi. Uzum kassangizning `/payment-methods` javobida bo‘lsa ochiladi. Summalar tiyinlarda yuboriladi. Tarif faqat server tekshirgan live/succeeded to‘lov bilan 30 kunga ochiladi. Test provider tarifni ochmaydi. Bir xil tarif uzaytirilganda qolgan kunlar saqlanadi. Takroriy callback bir xil to‘lovni qayta faollashtirmaydi.

`node tests/tezcheck-security.cjs` imzo, timestamp, test to‘lovi va summa mosligini haqiqiy pul ishlatmasdan tekshiradi.

Rasmiy API hujjatlari: https://tezcheck.uz/api-docs

`npm run payment:check` token, kassa kodi va so‘rov imzosini `GET /me` orqali tekshiradi. Bu buyruq to‘lov yaratmaydi va maxfiy kalitlarni chiqarmaydi.
