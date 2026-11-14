import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const [platform, file, certificateFile] = process.argv.slice(2);
if (process.env.CI !== 'true' || !['android', 'windows'].includes(platform)) throw new Error('Ilova chiqarish jarayonida ishga tushiring');
const repository = process.env.GITHUB_REPOSITORY;
if (repository !== 'Rasulbek917/Shop_uz-') throw new Error('Repository mos kelmadi');
const bytes = readFileSync(file);
const filename = platform === 'android' ? 'savdoza-android.apk' : 'savdoza-windows-setup.exe';
const entry = {
  url: `https://github.com/${repository}/releases/download/${platform}-latest/${filename}`,
  version: `2.0.0+${process.env.GITHUB_RUN_NUMBER}`,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  channel: 'preview',
};
const lock = platform === 'android' ? readFileSync('apps/savdoza_client/pubspec.lock') : null;
const fingerprint = certificateFile ? createHash('sha256').update(readFileSync(certificateFile)).digest('hex').toUpperCase().match(/../g).join(':') : null;
if (platform === 'android' && !fingerprint) throw new Error('Android sertifikati kerak');
const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
for (let attempt = 0; attempt < 4; attempt++) {
  git('fetch', 'origin', 'main');
  git('reset', '--hard', 'origin/main');
  const manifest = JSON.parse(readFileSync('public/releases/manifest.json', 'utf8'));
  manifest[platform] = entry;
  writeFileSync('public/releases/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  const paths = ['public/releases/manifest.json'];
  if (platform === 'android') {
    mkdirSync('public/.well-known', { recursive: true });
    writeFileSync('public/.well-known/assetlinks.json', JSON.stringify([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'uz.savdoza.savdoza_client', sha256_cert_fingerprints: [fingerprint] },
    }], null, 2) + '\n');
    writeFileSync('apps/savdoza_client/pubspec.lock', lock);
    paths.push('public/.well-known/assetlinks.json', 'apps/savdoza_client/pubspec.lock');
  }
  git('add', ...paths);
  if (spawnSync('git', ['diff', '--cached', '--quiet']).status === 0) process.exit(0);
  git('commit', '-m', `chore: publish ${platform} download details`);
  if (spawnSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' }).status === 0) process.exit(0);
}
throw new Error('Yuklab olish ma’lumotlari yangilanmadi');
