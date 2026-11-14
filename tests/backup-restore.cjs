const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readdirSync, rmSync, statSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/savdoza_test') throw new Error('Alohida local savdoza_test bazasi kerak');
const directory = mkdtempSync(path.join(tmpdir(), 'savdoza-backup-'));
const env = { ...process.env, DIRECT_URL: '', BACKUP_DIR: directory };
const connection = new URL(database);
env.PGPASSWORD = decodeURIComponent(connection.password);
connection.password = '';
connection.search = '';
const sql = query => execFileSync('psql', [connection.toString(), '-v', 'ON_ERROR_STOP=1', '-Atc', query], { env, encoding: 'utf8' }).trim();
try {
  sql("CREATE TABLE backup_probe (id int primary key, name text not null); INSERT INTO backup_probe VALUES (1, 'Savdoza tekshiruv'), (2, 'Ombor sinovi');");
  // Prisma query parameters must not break the PostgreSQL command-line tools.
  env.DATABASE_URL = database.toString() + '?schema=public&pgbouncer=true&connection_limit=1';
  execFileSync(process.execPath, ['scripts/backup.mjs'], { env, stdio: 'inherit' });
  const files = readdirSync(directory);
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith('.dump'));
  const dump = path.join(directory, files[0]);
  assert.ok(statSync(dump).size > 0);
  sql('DROP TABLE backup_probe');
  execFileSync(process.execPath, ['scripts/restore.mjs', dump], { env, stdio: 'inherit' });
  assert.equal(sql('SELECT count(*) FROM backup_probe'), '2');
  assert.equal(sql('SELECT name FROM backup_probe WHERE id=1'), 'Savdoza tekshiruv');
  console.log('Backup and transactional restore verified with PostgreSQL and Prisma connection parameters.');
} finally {
  sql('DROP TABLE IF EXISTS backup_probe');
  rmSync(directory, { recursive: true, force: true });
}
