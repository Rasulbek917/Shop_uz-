import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

export function validWebhook(raw: string, headers: Headers, secret: string, now = Date.now()): boolean {
  const timestamp = headers.get("x-checkout-timestamp") || "";
  const delivery = headers.get("x-checkout-delivery") || "";
  if (!secret || !/^\d+$/.test(timestamp) || !delivery || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = "v1=" + createHmac("sha256", secret).update(`${timestamp}.${delivery}.${raw}`).digest("hex");
  return (headers.get("x-checkout-signature") || "").split(",").some(value => {
    const candidate = value.trim();
    return /^v1=[a-f0-9]{64}$/.test(candidate) && timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
  });
}

const paymentSchema = z.object({
  bill: z.object({ id: z.string(), external_reference: z.string(), amount_minor: z.number().int(), currency: z.literal("UZS"), paid: z.boolean(), livemode: z.boolean(), environment: z.string().nullable() }),
  payment: z.object({ id: z.string(), state: z.string(), amount_minor: z.number().int(), currency: z.literal("UZS"), livemode: z.boolean(), environment: z.string(), refunded_amount_minor: z.number().int() }).nullable(),
});

export function verifiedPayment(value: unknown, order: { id: string; billId: string | null; amount: number }): string | null {
  const parsed = paymentSchema.safeParse(value);
  if (!parsed.success) throw new Error("Tezcheck javob formati mos emas");
  const { bill, payment } = parsed.data;
  if (bill.id !== order.billId || bill.external_reference !== order.id || bill.amount_minor !== order.amount * 100) throw new Error("To‘lov hisobga mos emas");
  if (!bill.paid) return null;
  if (!bill.livemode || bill.environment !== "live" || !payment?.livemode || payment.environment !== "live") return null;
  if (payment.state !== "succeeded" || payment.refunded_amount_minor !== 0) return null;
  if (payment.amount_minor !== order.amount * 100) throw new Error("To‘lov summasi mos emas");
  return payment.id;
}

// An unset provider limit is returned as null. Keep numeric bounds in the public API.
export const paymentMethodSchema = z.object({
  provider_code: z.string().min(1),
  name: z.string(),
  currency: z.literal("UZS"),
  min_amount_minor: z.number().int().nonnegative().safe().nullable().transform(value => value ?? 0),
  max_amount_minor: z.number().int().nonnegative().safe().nullable().transform(value => value ?? Number.MAX_SAFE_INTEGER),
});

export function paymentErrorMessage(status: number, value: unknown): string {
  const parsed = z.object({ error: z.object({
    code: z.string().optional(),
    request_id: z.string().optional(),
    details: z.array(z.object({ field: z.string().optional(), code: z.string().optional() })).optional(),
  }) }).safeParse(value);
  const error = parsed.success ? parsed.data.error : undefined;
  const safeCode = (value?: string) => value && /^[a-z_]+(?:\.[a-z_]+)+$/.test(value) ? value : "";
  const code = safeCode(error?.code);
  const details = error?.details || [];
  let message = "Tezcheck so‘rovni rad etdi";
  if (details.some(d => d.code === "cash_desk.default_link_not_active")) {
    message = "Tezcheck kassasining asosiy to‘lov havolasi faol emas. Kassa sozlamalarida uni yoqing";
  } else if (details.some(d => d.field === "return_url")) {
    message = "Tezcheck’da shop.aminboyevrasulbek.uz domeni va to‘lovdan qaytish manziliga ruxsatni tekshiring";
  } else if (code === "request.validation_failed") {
    message = "Tezcheck to‘lov ma’lumotlarini qabul qilmadi";
  } else if (code === "payment_link.amount_out_of_range") {
    message = "Tarif summasi Tezcheck kassangizning ruxsat etilgan chegarasiga mos emas";
  } else if (code === "request.idempotency_key_reused") {
    message = "Oldingi to‘lov hisobining ma’lumotlari o‘zgargan. Administrator tekshirishi kerak";
  } else if (code === "resource.conflict" || code === "request.nonce_replayed") {
    message = "Oldingi so‘rov hali tekshirilmoqda. Bir necha soniyadan keyin qayta urinib ko‘ring";
  } else if (code === "resource.state_invalid") {
    message = "Tezcheck kassasi yoki to‘lov havolasi holatini tekshiring";
  } else if (code === "resource.not_found") {
    message = "Tezcheck kassasi topilmadi. Kassa kodi API tokeniga tegishli ekanini tekshiring";
  } else if (status === 401 || status === 403) {
    message = "Tezcheck API tokeni, kassa ruxsatlari va IP cheklovlarini tekshiring";
  } else if (status === 429) {
    message = "Tezcheck so‘rovlar chegarasiga yetildi. Biroz kutib qayta urinib ko‘ring";
  }
  const codes = [code, ...details.map(d => safeCode(d.code))].filter(Boolean);
  const reference = error?.request_id && /^req_[A-Za-z0-9_-]{1,100}$/.test(error.request_id) ? ` · ${error.request_id}` : "";
  return `${message} (HTTP ${status}${codes.length ? " · " + codes.join(", ") : ""}${reference})`;
}
