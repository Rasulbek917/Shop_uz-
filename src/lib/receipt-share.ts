import { createHmac, timingSafeEqual } from "crypto";

function signature(id: string): string {
  const secret = process.env.RECEIPT_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Chek havolasi kaliti sozlanmagan");
  return createHmac("sha256", secret)
    .update(`savdoza-receipt-v1.${id}`)
    .digest("hex");
}
export function receiptToken(id: string): string {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
    throw new Error("Chek identifikatori noto‘g‘ri");
  return `${id}.${signature(id)}`;
}
export function receiptId(token: string): string | null {
  const match = /^([a-zA-Z0-9-]{1,80})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  return timingSafeEqual(
    Buffer.from(match[2]),
    Buffer.from(signature(match[1])),
  )
    ? match[1]
    : null;
}
export function receiptUrl(id: string): string {
  const origin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) throw new Error("Sayt manzili sozlanmagan");
  return new URL(`/chek/${receiptToken(id)}`, origin).toString();
}
