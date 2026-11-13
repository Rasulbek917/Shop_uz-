// Independent local database; the configured remote database is never modified.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const port = 55432;
const secretFile = resolve('.local-credentials.json');
const credentials = existsSync(secretFile) ? JSON.parse(readFileSync(secretFile,'utf8')) : { database: randomBytes(24).toString('hex'), jwt: randomBytes(40).toString('hex'), admin: randomBytes(12).toString('base64url') };
if (!existsSync(secretFile)) writeFileSync(secretFile, JSON.stringify(credentials), {mode:0o600});
const env = {...process.env, DATABASE_URL:`postgresql://postgres:${credentials.database}@127.0.0.1:${port}/savdoza_local?schema=public`, JWT_SECRET:credentials.jwt, APP_URL:'http://localhost:3000', NEXT_PUBLIC_APP_URL:'http://localhost:3000'};
const pg = new EmbeddedPostgres({databaseDir:resolve('.pgdata-local'),user:'postgres',password:credentials.database,port,persistent:true,initdbFlags:['--encoding=UTF8','--locale=C']});
let app;
async function run(args) { await new Promise((ok,fail)=>{const c=spawn(process.execPath,args,{env,stdio:'inherit'});c.on('error',fail);c.on('exit',code=>code===0?ok():fail(new Error('Amal bajarilmadi: '+args.join(' '))));}); }
async function stop(){app?.kill('SIGTERM');await pg.stop().catch(()=>{});}
process.on('SIGINT',()=>stop().finally(()=>process.exit()));process.on('SIGTERM',()=>stop().finally(()=>process.exit()));
try {
 console.log('LOKAL REJIM: alohida yangi baza ishlatiladi. Eski onlayn do‘kon ma’lumotlari bu yerda bo‘lmaydi.');
 if(!existsSync(resolve('.pgdata-local/PG_VERSION'))) await pg.initialise();
 await pg.start();
 const client=pg.getPgClient();await client.connect();
 const result=await client.query("SELECT 1 FROM pg_database WHERE datname='savdoza_local'");
 if(!result.rowCount) await client.query('CREATE DATABASE savdoza_local');
 await client.end();
 await run(['node_modules/prisma/build/index.js','generate']);
 await run(['node_modules/prisma/build/index.js','migrate','deploy']);
 Object.assign(process.env,env);
 const {PrismaClient}=await import('@prisma/client');const {default:bcrypt}=await import('bcryptjs');const db=new PrismaClient();
 try { await db.user.upsert({where:{username:'superadmin'},update:{},create:{username:'superadmin',fullName:'Lokal administrator',role:'SUPER_ADMIN',passwordHash:await bcrypt.hash(credentials.admin,12)}}); } finally {await db.$disconnect();}
 console.log('Lokal login: superadmin');console.log('Lokal parol: '+credentials.admin);
 app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-H','127.0.0.1','-p','3000'],{env,stdio:'inherit'});
 await new Promise((ok,fail)=>{app.on('error',fail);app.on('exit',ok);});await stop();
} catch(e){console.error('Lokal server ishga tushmadi:',e.message);await stop();process.exitCode=1;}
