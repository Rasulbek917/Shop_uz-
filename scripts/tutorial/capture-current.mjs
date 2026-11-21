import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';

const base = process.env.APP_URL || 'http://127.0.0.1:3000';
const url = new URL(base);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Faqat lokal demo sayti yoziladi.');
const output = resolve(process.env.TUTORIAL_OUTPUT || 'tutorial-output');
const framesDir = join(output, 'frames');
const textDir = join(output, 'ovoz-matnlari');
mkdirSync(framesDir, { recursive: true });
mkdirSync(textDir, { recursive: true });

const chapters = [];
const guide = readFileSync(resolve('docs/video-qollanma-uz.md'), 'utf8');
const texts = [...guide.matchAll(/## (\d+)\. ([^\n]+)[\s\S]*?\*\*Ovoz:\*\* “([^”]+)”/g)];
for (const [, number, title, spoken] of texts) {
  writeFileSync(join(textDir, `${number.padStart(2, '0')}.txt`), spoken + '\n');
}
if (texts.length !== 15) throw new Error(`15 ovoz matni kutilgan edi, ${texts.length} topildi.`);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'uz-UZ', timezoneId: 'Asia/Tashkent' });
await context.route('**/*', route => {
  const requested = new URL(route.request().url());
  return ['127.0.0.1', 'localhost'].includes(requested.hostname) || requested.protocol === 'data:' ? route.continue() : route.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let count = 0;
async function visit(path) {
  const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) throw new Error(`${path}: HTTP ${response?.status()}`);
  await page.locator('main, .pos-workspace').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(1000);
}
async function capture(chapter, title) {
  const file = `${String(++count).padStart(2, '0')}-${chapter}.png`;
  await page.screenshot({ path: join(framesDir, file), timeout: 60000 });
  chapters.push({ chapter, title, file: join(framesDir, file), seconds: 12 });
  console.log(`${count}. ${title}`);
}
try {
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Loginingiz').waitFor();
  await page.getByRole('button', { name: 'Kirish', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Kirish'));
    return button && !button.disabled;
  });
  await capture(1, 'Kirish');
  await page.getByPlaceholder('Loginingiz').fill(process.env.DEMO_USERNAME || 'demo_shop_local');
  await page.getByPlaceholder('Parolingiz').fill(process.env.DEMO_PASSWORD || 'DemoShop2026!');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await page.waitForURL('**/admin');
  await capture(1, 'Bosh sahifa');

  await visit('/admin/tovarlar'); await capture(3, 'Tovarlar katalogi');
  await visit('/admin/ombor'); await capture(4, 'Ombor qoldiqlari');
  await visit('/kassir/smena'); await capture(2, 'Smena boshlanishi');
  if (await page.getByRole('button', { name: 'Smenani ochish' }).isVisible()) {
    await page.getByRole('button', { name: 'Smenani ochish' }).click();
    await page.getByRole('heading', { name: 'Smena ochiq' }).waitFor();
  }
  await capture(2, 'Ochiq smena');
  await visit('/kassir');
  await page.getByRole('button', { name: 'Qo‘shish' }).first().waitFor();
  await capture(5, 'Mahsulotni qidirish');
  await page.getByRole('row').filter({ hasText: 'Namuna · Non' }).getByRole('button', { name: 'Qo‘shish' }).click();
  await page.getByRole('spinbutton', { name: 'Namuna · Non miqdori' }).fill('2');
  await capture(5, 'Savat va miqdor');
  await capture(6, 'Mijoz va chegirma');
  await page.getByRole('button', { name: 'To‘lovni qabul qilish' }).click();
  await capture(7, 'To‘lov turi');
  await page.getByRole('button', { name: 'Sotuvni Yakunlash va Chek Chiqarish' }).click();
  await page.getByRole('button', { name: 'Chek chiqarish' }).waitFor();
  await capture(7, 'Yakunlangan chek');
  await page.getByRole('button', { name: 'Yangi savdo' }).click();
  await capture(8, 'Yangi chek');
  await visit('/kassir/cheklar'); await capture(9, 'Cheklar tarixi');
  await visit('/kassir/qaytarish'); await capture(9, 'Qaytarish');
  await visit('/admin/mijozlar'); await capture(10, 'Mijozlar va bonus');
  await visit('/admin/qarzlar'); await capture(10, 'Qarzlar');
  await visit('/kassir/smena'); await capture(11, 'Smena natijasi');
  if (await page.getByRole('button', { name: 'Kutilgan summani qo‘yish' }).isVisible()) {
    await page.getByRole('button', { name: 'Kutilgan summani qo‘yish' }).click();
    await page.getByRole('button', { name: 'Smenani yopish' }).click();
    await page.getByRole('heading', { name: 'Smena yopiq' }).waitFor();
  }
  await capture(11, 'Yopilgan smena');
  await visit('/admin/hisobotlar'); await capture(12, 'Hisobotlar');
  await visit('/admin/moliya'); await capture(13, 'Moliya');
  await visit('/admin/xodimlar'); await capture(13, 'Xodimlar');
  await visit('/sozlamalar/ilovalar'); await capture(14, 'Ilovalarni boshqarish');
  await visit('/sozlamalar/tarif'); await capture(14, 'Tariflar');
  await visit('/kassir'); await capture(15, 'Savdo tartibi');
} finally {
  await browser.close();
}

if (errors.length) throw new Error(`Sahifa xatolari: ${errors.join('; ')}`);
const concat = chapters.flatMap(item => [`file '${item.file.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`, `duration ${item.seconds}`]);
concat.push(`file '${chapters.at(-1).file.replaceAll('\\', '/')}'`);
const concatFile = join(output, 'kadrlar.txt');
writeFileSync(concatFile, concat.join('\n') + '\n');
writeFileSync(join(output, 'boblar.json'), JSON.stringify(chapters.map(({ chapter, title, seconds }, index) => ({ chapter, title, startSeconds: index * seconds, seconds })), null, 2) + '\n');
execFileSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concatFile, '-vf', 'fps=12,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(output, 'savdoza-video-qoralama.mp4')], { stdio: 'inherit' });
console.log(JSON.stringify({ frames: chapters.length, video: join(output, 'savdoza-video-qoralama.mp4'), narrationTexts: textDir }));
