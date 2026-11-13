import { spawnSync } from 'node:child_process';

// Vercel serves Next.js without running npm start, so production migrations run during build.
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL) {
    console.error('Vercel Production uchun DATABASE_URL kiritilmagan.');
    process.exit(1);
  }
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
  if (result.error) {
    console.error('Baza migratsiyasini ishga tushirib bo‘lmadi.');
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}
