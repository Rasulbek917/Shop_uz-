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
