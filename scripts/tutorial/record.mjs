import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { chromium } from 'playwright';

const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (process.env.CI !== 'true' || !['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/savdoza_tutorial') {
  throw new Error('Video faqat alohida lokal savdoza_tutorial bazasida yoziladi');
}
const base = 'http://localhost:3000';
assert.equal(process.env.APP_URL, base);
const output = resolve(process.env.TUTORIAL_OUTPUT || '/tmp/savdoza-tutorial');
mkdirSync(output, { recursive: true });
const prisma = new PrismaClient();
const username = 'namuna_dokon';
const password = 'Tutorial-Only-2026!';
const width = 1280, height = 800, captionHeight = 88;
let server, browser, context, page;
const scenes = [];
let started = 0, trim = 0;
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const mark = (title, text) => scenes.push({ title, text, start: Number(((performance.now() - started) / 1000).toFixed(2)) });
const hold = () => wait(2800);
async function navigate(path) {
  await page.locator(`a[href="${path}"]`).filter({ visible: true }).first().click();
  await page.waitForURL(`**${path}`);
  await wait(1500);
}
async function snapshot(name) {
  await page.screenshot({ path: join(output, `${name}.png`) });
}
function clock(seconds, separator = '.') {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor(milliseconds / 60000) % 60;
  const secs = Math.floor(milliseconds / 1000) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(milliseconds % 1000).padStart(3, '0')}`;
}
try {
  const shop = await prisma.shop.create({ data: {
    name: 'Namuna do‘kon', adminName: 'Namuna foydalanuvchi', phone: '+998 90 000 00 00', address: 'Namuna manzil',
    status: 'ACTIVE', planCode: 'MAX', subscriptionType: 'MAX', subscriptionEndDate: new Date(Date.now() + 30 * 86400000),
  } });
  const owner = await prisma.user.create({ data: { shopId: shop.id, role: 'SHOP_ADMIN', fullName: 'Namuna foydalanuvchi', username, passwordHash: await bcrypt.hash(password, 10) } });
  const category = await prisma.category.create({ data: { shopId: shop.id, name: 'Oziq-ovqat' } });
  const fixtures = [['Sut 1 L',12000,8000,40],['Non',4000,2500,80],['Choy 100 g',18000,13000,30],['Guruch 1 kg',16000,12000,50]];
  const products = [];
  for (const [index, [name, salePrice, purchasePrice, quantity]] of fixtures.entries()) {
    const product = await prisma.product.create({ data: { shopId: shop.id, categoryId: category.id, name, salePrice, barcode: `47812345600${index}`, minStock: 5, unit: 'dona' } });
    const batch = await prisma.productBatch.create({ data: { shopId: shop.id, productId: product.id, batchNumber: `NAMUNA-${index+1}`, purchasePrice, salePrice, initialQuantity: quantity + (index === 0 ? 16 : 0), currentQuantity: quantity, expiryDate: new Date(Date.now()+180*86400000) } });
    products.push({ product, batch });
  }
  for (let index = 0; index < 8; index++) {
    const createdAt = new Date(Date.now() - (index % 7) * 86400000);
    const { product, batch } = products[0];
    await prisma.sale.create({ data: { shopId: shop.id, cashierId: owner.id, receiptNumber: `NAMUNA-${String(index + 1).padStart(3,'0')}`, paymentMethod: 'CASH', totalAmount: 24000, payableAmount: 24000, paidAmount: 24000, createdAt, status: 'COMPLETED', items: { create: { productId: product.id, batchId: batch.id, quantity: 2, unitPrice: 12000, purchasePrice: 8000, totalPrice: 24000 } }, payments: { create: { shopId: shop.id, amount: 24000, paymentMethod: 'CASH', status: 'SUCCESS' } } } });
  }

  const log = createWriteStream(join(output, 'server.log'));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3000'], { stdio: ['ignore','pipe','pipe'], env: { ...process.env, NODE_ENV: 'production' } });
  server.stdout.pipe(log); server.stderr.pipe(log);
  let ready = false;
  for (let index=0; index<60; index++) {
    try { if ((await fetch(base+'/api/health')).ok) { ready=true; break; } } catch {}
    await wait(1000);
  }
  assert.ok(ready, 'Namuna sayt ishga tushmadi');
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: join(output,'raw'), size: { width, height } }, locale: 'uz-UZ', timezoneId: 'Asia/Tashkent', colorScheme: 'light' });
  // The recording only uses the isolated local application and its real APIs.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost','127.0.0.1'].includes(url.hostname) || url.protocol === 'data:' ? route.continue() : route.abort();
  });
  const videoOrigin = performance.now();
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => console.log('Page error:',error.message));
  await page.goto(base+'/login');
  await page.getByRole('button',{ name:'Kirish', exact:true }).waitFor();
  started = performance.now(); trim = (started-videoOrigin)/1000;
  mark('Hisobga kirish', 'Shaxsiy login va parolingizni kiriting. Bu videoda namuna do‘kon ishlatilgan.');
  await hold();
  await page.getByPlaceholder('Loginingiz').pressSequentially(username,{ delay:65 });
  await page.getByPlaceholder('Parolingiz').pressSequentially(password,{ delay:55 });
  await hold();
  await Promise.all([page.waitForURL('**/admin'),page.getByRole('button',{ name:'Kirish',exact:true }).click()]);
  await page.getByText('Bugungi Savdo',{exact:true}).waitFor();
  mark('Dashboard', 'Bugungi savdo, cheklar va ombor holatini shu yerdan kuzatasiz.');
  await hold(); await snapshot('dashboard');
  await hold();

  mark('Mahsulot qo‘shish', 'Mahsulotlar katalogini oching va “Yangi Mahsulot Qo‘shish”ni bosing.');
  await navigate('/admin/mahsulotlar');
  await page.getByRole('button',{name:'Yangi Mahsulot Qo‘shish',exact:true}).click();
  await hold();
  await page.getByPlaceholder('Masalan: Guruch 1 kg').pressSequentially('Shakar 1 kg',{delay:90});
  await page.getByPlaceholder('478000...').pressSequentially('4781234560099',{delay:65});
  const form = page.locator('.fixed form');
  await form.locator('select').nth(0).selectOption(category.id);
  await form.locator('input[type="number"]').nth(0).fill('14000');
  mark('Narxni belgilang', 'Mahsulot nomi, kodi, kategoriyasi va sotuv narxini kiriting. “Saqlash”ni bosing.');
  await hold(); await snapshot('product-form');
  const createResponse = page.waitForResponse(response => response.url().endsWith('/api/products') && response.request().method() === 'POST');
  await form.getByRole('button',{name:'Saqlash',exact:true}).click();
  assert.equal((await createResponse).status(),200);
  await page.getByRole('heading',{name:'Mahsulot Muvaffaqiyatli Qo‘shildi!',exact:true}).waitFor();
  await hold();
  await page.getByRole('button',{name:'Katalogga qaytish',exact:true}).click();
  mark('Ombor qoldig‘i', 'Mahsulot kartasi saqlandi. Sotuv uchun omborda yaroqli partiya va qoldiq bo‘lishi kerak.');
  await navigate('/admin/ombor');
  await page.getByText('NAMUNA-1',{exact:true}).waitFor();
  await hold(); await snapshot('inventory');

  mark('POS terminal', 'POS bo‘limida omborda mavjud mahsulotni tanlang. Namuna savdoda Sut va Non sotamiz.');
  await navigate('/admin/pos');
  const milk = page.getByRole('button').filter({has:page.getByText('Sut 1 L',{exact:true})});
  await milk.waitFor(); await hold();
  await milk.click(); await wait(1600);
  await page.getByRole('button').filter({has:page.getByText('Non',{exact:true})}).click();
  mark('Savatni tekshiring', 'Mahsulotlar, miqdor va jami summani tekshiring. So‘ng “To‘lovga O‘tish”ni bosing.');
  await hold(); await snapshot('pos-cart');
  await page.getByRole('button',{name:/To‘lovga O‘tish/}).click();
  await page.getByRole('heading',{name:'To‘lovni Qabul Qilish',exact:true}).waitFor();
  mark('To‘lovni qayd eting', 'To‘lov turini va qabul qilingan summani tekshiring. Bu namuna savdo naqd usulida.');
  await page.getByRole('button',{name:'Naqd pul',exact:true}).click();
  await hold(); await snapshot('payment');
  const saleResponse = page.waitForResponse(response => response.url().endsWith('/api/sales') && response.request().method() === 'POST');
  await page.getByRole('button',{name:'Sotuvni Yakunlash va Chek Chiqarish',exact:true}).click();
  const saleResult = await (await saleResponse).json();
  assert.equal(saleResult.success,true,JSON.stringify(saleResult));
  assert.equal(saleResult.data.payableAmount,16000);
  await page.getByRole('button',{name:'Chek chiqarish',exact:true}).waitFor();
  mark('Chek tayyor', 'Chekni ko‘ring. “Chek chiqarish” tugmasidan chop etish oynasi ochiladi.');
  await hold(); await snapshot('receipt'); await hold();
  await page.getByRole('button',{name:'Yangi savdo',exact:true}).click();

  mark('Cheklar tarixi', 'Cheklar bo‘limida oldingi savdolar saqlanadi. Kerakli chekni qayta ochishingiz mumkin.');
  await navigate('/admin/cheklar');
  await page.getByRole('button',{name:'Ko‘rish / chiqarish',exact:true}).first().waitFor();
  await hold(); await snapshot('receipts'); await hold();
  mark('Hisobotlar', 'Hisobotlarda tushum va savdo natijalarini kuzating. Videodagi ma’lumotlar — namuna.');
  await navigate('/admin/hisobotlar');
  await page.getByRole('button',{name:/Kunlik/}).first().waitFor();
  await hold(); await snapshot('reports'); await hold();
  assert.equal(await prisma.sale.count({where:{shopId:shop.id}}),9);
  assert.equal(await prisma.product.count({where:{shopId:shop.id}}),5);
  const duration = Number(((performance.now()-started)/1000).toFixed(2));
  const video = page.video();
  await context.close(); context=null;
  await video.saveAs(join(output,'recording.webm'));
  await browser.close(); browser=null;

  const chunks = scenes.map((scene,index)=>({...scene,end:scenes[index+1]?.start ?? duration}));
  const escapeAss = text => text.replaceAll('\\','/').replaceAll('{','(').replaceAll('}',')');
  const assTime = seconds => clock(seconds).slice(0,-1);
  const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height+captionHeight}\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Guide,DejaVu Sans,25,&H00FFFFFF,&H00FFFFFF,&H001D3629,&H001D3629,0,0,0,0,100,100,0,0,1,0,0,2,24,24,14,1\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`+chunks.map(scene=>`Dialogue: 0,${assTime(scene.start)},${assTime(scene.end)},Guide,,0,0,0,,{\\b1}${escapeAss(scene.title)}{\\b0}\\N${escapeAss(scene.text)}`).join('\n');
  writeFileSync(join(output,'captions.ass'),ass);
  writeFileSync(join(output,'savdoza-tutorial.vtt'),'WEBVTT\n\n'+chunks.map(scene=>`${clock(scene.start)} --> ${clock(scene.end)}\n${scene.title}. ${scene.text}\n`).join('\n'));
  writeFileSync(join(output,'savdoza-tutorial.json'),JSON.stringify({duration,chapters:chunks.map(({title,start})=>({title,start})),kind:'actual-interface-sample-data',narration:'uzbek-captions'},null,2)+'\n');
  execFileSync('ffmpeg',['-y','-ss',String(trim),'-i',join(output,'recording.webm'),'-t',String(duration),'-vf',`pad=${width}:${height+captionHeight}:0:0:color=0x1D3629,subtitles=${join(output,'captions.ass')}`,'-r','25','-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',join(output,'savdoza-tutorial.mp4')],{stdio:'inherit'});
  execFileSync('ffmpeg',['-y','-ss',String(chunks.find(scene=>scene.title==='POS terminal').start+3),'-i',join(output,'savdoza-tutorial.mp4'),'-frames:v','1',join(output,'savdoza-tutorial-poster.webp')],{stdio:'inherit'});
  const media=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',join(output,'savdoza-tutorial.mp4')],{encoding:'utf8'}));
  assert.equal(media.streams[0].codec_name,'h264');
  assert.ok(Number(media.format.duration)>50);
  console.log(JSON.stringify({duration:media.format.duration,chapters:chunks.map(({title,start})=>({title,start})),actualSales:9,actualProducts:5}));
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});
    console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-1800));
  }
  throw error;
} finally {
  if (context) await context.close().catch(()=>{});
  if (browser) await browser.close().catch(()=>{});
  server?.kill('SIGTERM');
  await prisma.$disconnect();
}
