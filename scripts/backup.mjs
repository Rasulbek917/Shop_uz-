// Production database backup: SQLite (file copy) yoki PostgreSQL (pg_dump).
// Ishlatish: node scripts/backup.mjs
import { randomBytes } from "node:crypto";
import { copyFile, readFile, chmod, rename, unlink } from "fs/promises";
import { existsSync, mkdirSync, statSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { postgresConnection } from "./postgres-tools.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadEnv() {
  try {
    const raw = await readFile(path.join(root, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env mavjud bo'lmasa, tizim env o'zgaruvchilari ishlatiladi
  }
}
await loadEnv();

const DATABASE_URL = process.env.DATABASE_URL || "";
const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(root, "backups"));
const stamp = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomBytes(4).toString("hex");

if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

if (/^postgres(?:ql)?:/.test(DATABASE_URL)) {
  const out = path.join(backupDir, `backup-${stamp}.dump`);
  const connection = postgresConnection();
  const temporary = out + '.partial';
  try {
    execFileSync("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", temporary, connection.url], { stdio: "inherit", env: connection.env });
    await chmod(temporary, 0o600);
    await rename(temporary, out);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw new Error('PostgreSQL backup bajarilmadi', { cause: error.code });
  }
  console.log(`✓ PostgreSQL backup yaratildi: ${out}`);
} else if (DATABASE_URL.startsWith("file:")) {
  const rel = DATABASE_URL.replace("file:", "");
  const dbFile = path.resolve(path.join(root, "prisma"), rel);
  if (!existsSync(dbFile)) {
    console.error(`✗ Database fayli topilmadi: ${dbFile}`);
    process.exit(1);
  }
  const out = path.join(backupDir, `backup-${stamp}.db`);
  await copyFile(dbFile, out);
  console.log(`✓ SQLite backup yaratildi: ${out} (${statSync(out).size} bayt)`);
} else {
  console.error("✗ DATABASE_URL aniqlanmadi yoki qo‘llab-quvvatlanmaydi");
  process.exit(1);
}
