# Production Deployment Guide (Savdoza)

## 1. Arxitektura

```
yourdomain.uz  →  HTTPS (reverse proxy: Nginx/Caddy)  →  Next.js server (VPS)  →  PostgreSQL
Desktop POS / Mobile  →  HTTPS API  →  Next.js backend  →  PostgreSQL
```

- Client hech qachon database'ga to'g'ridan-to'g'ri ulanmaydi — faqat API orqali.
- Next.js barcha API routelarda auth + tenant scopinini o'zi tekshiradi (`src/lib/tenant.ts`).

## 2. PostgreSQL'ga o'tish (migration workflow)

Development va production: PostgreSQL. Lokal baza uchun `npm run db:start` ishlatiladi.
Production: PostgreSQL + **`prisma migrate deploy`** (db push EMAS).

1. `.env` (production):
   ```
   DATABASE_URL="postgresql://USER:STRONG_PASSWORD@localhost:5432/savdoza?schema=public"
   JWT_SECRET="<64 belgili tasodifiy string>"
   NEXT_PUBLIC_APP_URL="https://yourdomain.uz"
   EXPIRY_WARNING_DAYS="90"
   NEXT_PUBLIC_EXPIRY_WARNING_DAYS="90"
   ```
2. `prisma/schema.prisma` PostgreSQL uchun sozlangan. `DATABASE_URL` va ulanish havzasidan tashqari `DIRECT_URL` mavjud bo‘lsa, uni server muhitiga kiriting.
3. `prisma/migrations/` papkasi PostgreSQL dialektidagi boshlang'ich migration'ni o'z ichiga oladi (`20260926000000_init`).
4. `npx prisma migrate deploy` — production DB'ni yaratadi.
5. Keyingi schema o'zgarishlari: development'da `npx prisma migrate dev --name <nom>` (PostgreSQL'ga ulangan holda) → migration fayli yaratiladi → production'da `migrate deploy`.
6. Initial Super Admin'ni env orqali belgilang va seed'ni production'da ISHLATMANG (`scripts/seed.mjs` faqat development demo ma'lumotlari uchun).

## 3. Backup / Restore / Recovery

- Backup: `node scripts/backup.mjs`
  - PostgreSQL: `backups/backup-<timestamp>.dump` (`pg_dump --format=custom`)
- Restore: `node scripts/restore.mjs backups/backup-<timestamp>.dump`
  - Restore'dan OLDIN yangi backup oling (joriy DB ustiga yoziladi).
- Tavsiya etilgan jadval: har kuni avtomatik backup (cron: `0 2 * * * node /path/scripts/backup.mjs`),
  backups papkasini serverdan tashqariga (object storage / boshqa disk) sinxronlash.
- Recovery tekshiruvi: restore'ni har oyda izolyatsiya qilingan nusxada sinab ko'ring
  (`DATABASE_URL` alohida sinov PostgreSQL bazasiga yo‘naltiriladi). Avtomatik sinov `node tests/backup-restore.cjs` orqali faqat lokal `savdoza_test` bazasida ishlaydi.
- `backups/` papkasi `.gitignore`'da — gitga tushmaydi.

## 4. Xavfsizlik checklist (production)

- [ ] `JWT_SECRET` kuchli tasodifiy qiymat (env, git'da YO'Q)
- [ ] `INITIAL_SUPER_ADMIN_PASSWORD` o'zgartirilgan
- [ ] HTTPS majburiy (cookie `Secure` flag uchun)
- [ ] PostgreSQL paroli kuchli, faqat localhost binding
- [ ] `npm run build && npm run start` — production mode (dev server EMAS)
- [ ] Server loglarida secret/parol yo'q (audit log faqat xavfsiz maydonlarni yozadi)
