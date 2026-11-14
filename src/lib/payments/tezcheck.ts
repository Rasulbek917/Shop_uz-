import { createHash, createHmac, randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/lib/onboarding";
import { verifiedPayment, paymentMethodSchema, paymentErrorMessage } from "./tezcheck-security";

const baseUrl = "https://api.tezcheck.uz/api/merchant/v1";
export function paymentConfigured() {
  return !!process.env.TEZCHECK_API_TOKEN && !!process.env.TEZCHECK_CASH_DESK_CODE;
}
const pendingReads = new Map<string, { until: number; promise: Promise<any> }>();

export function tezcheck(path: string, body?: unknown, idempotencyKey?: string): Promise<any> {
  // Identical status reads share a signed request within its timestamp second.
  if (body !== undefined || idempotencyKey) return sendTezcheck(path, body, idempotencyKey);
  const existing = pendingReads.get(path);
  if (existing && existing.until > Date.now()) return existing.promise;
  const promise = sendTezcheck(path);
  pendingReads.set(path, { until: Date.now() + 1100, promise });
  setTimeout(() => { if (pendingReads.get(path)?.promise === promise) pendingReads.delete(path); }, 15000);
  return promise;
}

async function sendTezcheck(path: string, body?: unknown, idempotencyKey?: string) {
  if (!paymentConfigured()) throw new BusinessError("Tezcheck API tokeni hali sozlanmagan", 503);
  const method = "POST";
  const raw = body === undefined ? "" : JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const url = new URL(baseUrl + path);
  const signature = createHmac("sha256", process.env.TEZCHECK_API_TOKEN!)
    .update(`${timestamp}.${method}.${url.pathname}.${createHash("sha256").update(raw).digest("hex")}`).digest("hex");
  const response = await fetch(url, {
    method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(7000),
    headers: { Authorization: `Bearer ${process.env.TEZCHECK_API_TOKEN}`, "X-Cash-Desk-Code": process.env.TEZCHECK_CASH_DESK_CODE!, "Content-Type": "application/json", "X-TezCheck-Timestamp": timestamp, "X-TezCheck-Signature": `v1=${signature}`, ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: raw || undefined,
  });
  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => null);
    throw new BusinessError(paymentErrorMessage(response.status, failure), 502);
  }
  return (await response.json()).data;
}
export async function paymentMethods() {
  return z.array(paymentMethodSchema).parse(await tezcheck("/payment-methods"));
}
const allowedStatuses = ["AWAITING_PAYMENT", "ACTIVE", "TRIAL", "EXPIRED"];

export async function createCheckout(shopId: string, planCode: "PRO" | "MAX", providerCode: string) {
  if (!paymentConfigured()) throw new BusinessError("Tezcheck API tokeni hali sozlanmagan", 503);
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop || !allowedStatuses.includes(shop.status)) throw new BusinessError("Hisob holati to‘lovga ruxsat bermaydi", 403);
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.enabled || plan.price <= 0) throw new BusinessError("Tarif xarid uchun yopilgan", 409);
  const amount = plan.price;
  const methods = await paymentMethods();
  if (!methods.some(m => m.provider_code === providerCode && m.min_amount_minor <= amount * 100 && m.max_amount_minor >= amount * 100)) throw new BusinessError("Tanlangan to‘lov usuli bu summa uchun ochilmagan");
  const origin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || new URL(origin).protocol !== "https:") throw new BusinessError("To‘lov uchun HTTPS sayt manzilini sozlang", 503);
  const activeKey = `${shopId}:${planCode}:${providerCode}:${amount}`;
  let order = await prisma.checkoutOrder.findUnique({ where: { activeKey } });
  if (!order) {
    const id = randomUUID();
    const returnUrl = new URL("/checkout", origin);
    returnUrl.searchParams.set("plan", planCode);
    returnUrl.searchParams.set("order", id);
    try {
      order = await prisma.checkoutOrder.create({ data: { id, shopId, planCode, providerCode, amount, activeKey, returnUrl: returnUrl.toString() } });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      order = await prisma.checkoutOrder.findUniqueOrThrow({ where: { activeKey } });
    }
  }
  if (order.paymentUrl) return { id: order.id, paymentUrl: order.paymentUrl };
  if (Date.now() - order.createdAt.getTime() > 23 * 3600000) throw new BusinessError("Oldingi to‘lov natijasi tekshirilishi kerak. Administratorga murojaat qiling", 409);
  const result = z.object({ bill: z.object({ id: z.string(), external_reference: z.string(), amount_minor: z.number().int(), currency: z.literal("UZS") }), payment_url: z.string().url() }).parse(await tezcheck("/bills", {
    amount_minor: order.amount * 100, title: `Savdoza ${order.planCode} — 30 kun`, external_reference: order.id, return_url: order.returnUrl, allowed_provider_codes: [order.providerCode],
  }, `savdoza-${order.id}`));
  if (result.bill.external_reference !== order.id || result.bill.amount_minor !== order.amount * 100 || new URL(result.payment_url).protocol !== "https:") throw new BusinessError("To‘lov javobi hisobga mos emas", 502);
  await prisma.checkoutOrder.update({ where: { id: order.id }, data: { billId: result.bill.id, paymentUrl: result.payment_url } });
  return { id: order.id, paymentUrl: result.payment_url };
}

export async function reconcileCheckout(id: string) {
  const order = await prisma.checkoutOrder.findUnique({ where: { id } });
  if (!order) throw new BusinessError("To‘lov topilmadi", 404);
  if (order.status === "PAID") return { status: "PAID" };
  if (!order.billId) return { status: order.status };
  const remote = await tezcheck(`/bills/${encodeURIComponent(order.billId)}`);
  const paymentId = verifiedPayment(remote, order);
  if (!paymentId) {
    if (!remote.bill.paid && ["expired", "revoked"].includes(remote.bill.state)) {
      await prisma.checkoutOrder.updateMany({ where: { id, status: "PENDING" }, data: { status: "EXPIRED", activeKey: null } });
      return { status: "EXPIRED" };
    }
    return { status: "PENDING" };
  }
  await prisma.$transaction(async tx => {
    const claimed = await tx.checkoutOrder.updateMany({ where: { id, status: { in: ["PENDING", "EXPIRED"] } }, data: { status: "PAID", paidAt: new Date(), paymentId, activeKey: null } });
    if (!claimed.count) return;
    const shop = await tx.shop.findUniqueOrThrow({ where: { id: order.shopId } });
    // Keep a paid order visible for support without reopening a blocked account.
    if (!allowedStatuses.includes(shop.status)) throw new BusinessError("Hisob bloklangan. To‘lovni administrator tekshirishi kerak", 409);
    const now = new Date();
    const start = shop.planCode === order.planCode && shop.subscriptionEndDate && shop.subscriptionEndDate > now ? shop.subscriptionEndDate : now;
    const end = new Date(start.getTime() + 30 * 86400000);
    await tx.shop.update({ where: { id: shop.id }, data: { status: "ACTIVE", planCode: order.planCode, subscriptionType: order.planCode, subscriptionStartDate: now, subscriptionEndDate: end } });
    await tx.subscription.create({ data: { shopId: shop.id, planName: order.planCode, price: order.amount, startDate: start, endDate: end, paymentMethod: "TEZCHECK", activatedBy: "TEZCHECK", notes: `To‘lov ${order.id}` } });
    await tx.auditLog.create({ data: { shopId: shop.id, action: "SUBSCRIPTION_PAID", entity: "CheckoutOrder", entityId: order.id, details: order.planCode } });
  }, { isolationLevel: "Serializable" });
  return { status: "PAID" };
}
