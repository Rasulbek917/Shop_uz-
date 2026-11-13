import nextEnv from '@next/env';
import { createHash, createHmac } from 'node:crypto';

nextEnv.loadEnvConfig(process.cwd());
const token = process.env.TEZCHECK_API_TOKEN;
const desk = process.env.TEZCHECK_CASH_DESK_CODE;
if (!token || !desk) {
  console.error('Tezcheck ulanmadi. .env ichida TEZCHECK_API_TOKEN va TEZCHECK_CASH_DESK_CODE ni to‘ldiring.');
  process.exitCode = 1;
} else {
  const path = '/api/merchant/v1/me';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', token).update(`${timestamp}.GET.${path}.${createHash('sha256').update('').digest('hex')}`).digest('hex');
  try {
    const response = await fetch(`https://api.tezcheck.uz${path}`, {
      redirect: 'error', signal: AbortSignal.timeout(7000),
      headers: { Authorization: `Bearer ${token}`, 'X-Cash-Desk-Code': desk, 'X-TezCheck-Timestamp': timestamp, 'X-TezCheck-Signature': `v1=${signature}` },
    });
    if (!response.ok) {
      console.error(`Tezcheck tekshiruvi bajarilmadi. HTTP ${response.status}. Token, kassa ruxsatlari va IP ro‘yxatini tekshiring.`);
      process.exitCode = 1;
    } else {
      const { data } = await response.json();
      if (data?.cash_desk?.code !== desk || data?.api_client?.request_signed !== true) {
        console.error('Kassa yoki imzolangan so‘rov tasdiqlanmadi. Tezcheck kabinetini tekshiring.');
        process.exitCode = 1;
      } else {
        console.log('Token, kassa va so‘rov imzosi tasdiqlandi. To‘lov yaratilmagan.');
        console.log(process.env.TEZCHECK_WEBHOOK_SECRET ? 'Webhook imzo kaliti kiritilgan.' : 'TEZCHECK_WEBHOOK_SECRET hali kiritilmagan.');
      }
    }
  } catch {
    console.error('Tezcheck serveriga ulanish bajarilmadi. Internet va server ruxsatlarini tekshiring.');
    process.exitCode = 1;
  }
}
