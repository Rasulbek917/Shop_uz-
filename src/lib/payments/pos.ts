import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/lib/onboarding";
import { TenantContext } from "@/lib/tenant";
import { saleSchema } from "@/lib/validations";
import { recordSale } from "@/lib/record-sale";
import { saleReplay, assertReplay } from "@/lib/sale-replay";
import { openCredentials } from "./pos-secrets";
import { sendTezcheck } from "./tezcheck";
import { verifiedPayment } from "./tezcheck-security";
export const posSaleSchema = saleSchema.extend({
    paymentMethod: z.literal("ELECTRONIC"),
    paidAmount: z.literal(0),
    idempotencyKey: z.string().min(10).max(100),
    occurredAt: z.undefined(),
});
const includeSale = { sale: { include: { items: true } } } as const;
type Order = NonNullable<Awaited<ReturnType<typeof findPosPayment>>>;
export function findPosPayment(id: string) {
    return prisma.posPayment.findUnique({ where: { id }, include: includeSale });
}
// Serializable claims make provider retries and simultaneous polling settle once.
async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0;; attempt++) {
        try {
            return await prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 15000 });
        }
        catch (error) {
            if ((error as {
                code?: string;
            }).code !== "P2034" || attempt >= 3)
                throw error;
        }
    }
}
export async function startPosPayment(input: z.infer<typeof posSaleSchema>, context: TenantContext) {
    const requestKey = `${context.shopId}:${input.idempotencyKey}`;
    let order = await prisma.posPayment.findUnique({ where: { requestKey }, include: includeSale });
    if (!order) {
        const gateway = await prisma.posGateway.findUnique({ where: { shopId: context.shopId } });
        if (!gateway)
            throw new BusinessError("Do‘kon sozlamalarida o‘z Tezcheck kassangizni ulang", 409);
        const origin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
        if (!origin || new URL(origin).protocol !== "https:")
            throw new BusinessError("Saytning HTTPS manzili sozlanmagan", 503);
        const id = randomUUID();
        const returnUrl = new URL(`/pos-payment/${id}`, origin).toString();
        try {
            order = await transaction(async (tx) => {
                const result = await recordSale(tx, { ...input, idempotencyKey: `POS-${requestKey}` }, context, true);
                if (!Number.isSafeInteger(result.sale.payableAmount * 100) || result.sale.payableAmount <= 0)
                    throw new BusinessError("Elektron to‘lov summasi noldan katta bo‘lishi kerak");
                return tx.posPayment.create({ data: { id, shopId: context.shopId, saleId: result.sale.id, requestKey, credentials: gateway.credentials, returnUrl }, include: includeSale });
            });
        }
        catch (error) {
            if ((error as {
                code?: string;
            }).code !== "P2002")
                throw error;
            order = await prisma.posPayment.findUniqueOrThrow({ where: { requestKey }, include: includeSale });
        }
    }
    if (context.user.role === "CASHIER" && order.sale.cashierId !== context.user.id) {
        throw new BusinessError("To‘lov bu kassirga tegishli emas", 403);
    }
    const replay = await saleReplay(context.shopId, `POS-${requestKey}`);
    if (!replay)
        throw new BusinessError("Savdo topilmadi", 404);
    assertReplay(replay, { ...input, paidAmount: replay.paidAmount });
    return ensurePosBill(order);
}
export async function ensurePosBill(order: Order) {
    if (order.status !== "PENDING" || order.paymentUrl)
        return order;
    if (Date.now() - order.createdAt.getTime() > 23 * 3600000)
        throw new BusinessError("To‘lov natijasi noma’lum. Tezcheck hisobini administrator tekshirishi kerak", 409);
    const credentials = openCredentials(order.shopId, order.credentials);
    const result = z.object({ bill: z.object({ id: z.string(), external_reference: z.string(), amount_minor: z.number().int(), currency: z.literal("UZS") }), payment_url: z.string().url() }).parse(await sendTezcheck("/bills", {
        amount_minor: order.sale.payableAmount * 100,
        title: `Savdo ${order.sale.receiptNumber}`,
        external_reference: order.id,
        return_url: order.returnUrl,
    }, `savdoza-pos-${order.id}`, credentials));
    const url = new URL(result.payment_url);
    if (result.bill.external_reference !== order.id || result.bill.amount_minor !== order.sale.payableAmount * 100 || url.protocol !== "https:" || url.hostname !== "tezcheck.uz" || url.username || url.password)
        throw new BusinessError("Tezcheck hisob javobi mos emas", 502);
    return prisma.posPayment.update({ where: { id: order.id }, data: { billId: result.bill.id, paymentUrl: result.payment_url }, include: includeSale });
}
const reads = new Map<string, {
    at: number;
    promise: Promise<Order>;
}>();
export async function reconcilePosPayment(order: Order): Promise<Order> {
    if (order.status !== "PENDING")
        return order;
    const existing = reads.get(order.id);
    if (existing && Date.now() - existing.at < 1500)
        return existing.promise;
    const promise = reconcile(order);
    reads.set(order.id, { at: Date.now(), promise });
    setTimeout(() => { if (reads.get(order.id)?.promise === promise)
        reads.delete(order.id); }, 15000);
    return promise;
}
async function reconcile(order: Order): Promise<Order> {
    order = await ensurePosBill(order);
    if (!order.billId)
        return order;
    const remote = await sendTezcheck(`/bills/${encodeURIComponent(order.billId)}`, undefined, undefined, openCredentials(order.shopId, order.credentials));
    const paymentId = verifiedPayment(remote, { id: order.id, billId: order.billId, amount: order.sale.payableAmount });
    if (paymentId) {
        await transaction(async (tx) => {
            const claimed = await tx.posPayment.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "PAID", paymentId, paidAt: new Date() } });
            if (!claimed.count)
                return;
            const sale = order.sale;
            await tx.sale.update({ where: { id: sale.id }, data: { status: "COMPLETED", paidAmount: sale.payableAmount, createdAt: new Date() } });
            await tx.payment.create({ data: { shopId: order.shopId, saleId: sale.id, amount: sale.payableAmount, paymentMethod: "ELECTRONIC", status: "SUCCESS" } });
            if (sale.customerId)
                await tx.customer.update({ where: { id: sale.customerId }, data: { totalSpent: { increment: sale.payableAmount }, purchasesCount: { increment: 1 } } });
            await tx.auditLog.create({ data: { shopId: order.shopId, action: "POS_PAYMENT_CONFIRMED", entity: "Sale", entityId: sale.id, details: `Tezcheck ${paymentId}` } });
        });
    }
    else if (remote.bill.paid && (!remote.bill.livemode || remote.bill.environment !== "live")) {
        throw new BusinessError("Sinov to‘lovi haqiqiy pul hisoblanmaydi. Haqiqiy to‘lov tasdig‘i kerak", 409);
    }
    else if (!remote.bill.paid && ["expired", "revoked"].includes(remote.bill.state) && !["processing", "pending", "unknown"].includes(remote.payment?.state)) {
        // Cancel remotely before releasing stock, including an expired link with an in-flight payment.
        return cancelPosPayment(order);
    }
    return prisma.posPayment.findUniqueOrThrow({ where: { id: order.id }, include: includeSale });
}
export async function cancelPosPayment(order: Order): Promise<Order> {
    if (order.status !== "PENDING")
        return order;
    order = await ensurePosBill(order);
    const cancelled = z.object({ cancelled: z.literal(true), bill: z.object({ id: z.string(), external_reference: z.string(), state: z.literal("revoked") }) }).parse(await sendTezcheck(`/bills/${encodeURIComponent(order.billId!)}/cancel`, { reason: "Savdo kassir tomonidan bekor qilindi" }, `savdoza-cancel-${order.id}`, openCredentials(order.shopId, order.credentials)));
    if (cancelled.bill.id !== order.billId || cancelled.bill.external_reference !== order.id)
        throw new BusinessError("Bekor qilish tasdig‘i mos emas", 502);
    await transaction(async (tx) => {
        const claimed = await tx.posPayment.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
        if (!claimed.count)
            return;
        await tx.sale.update({ where: { id: order.saleId }, data: { status: "CANCELLED" } });
        for (const item of order.sale.items) {
            await tx.productBatch.update({ where: { id: item.batchId }, data: { currentQuantity: { increment: item.quantity } } });
            await tx.inventoryTransaction.create({ data: { shopId: order.shopId, productId: item.productId, batchId: item.batchId, type: "INFLOW_PAYMENT_CANCEL", quantity: item.quantity, unitPrice: item.unitPrice, createdById: order.sale.cashierId, notes: `Bekor qilingan to‘lov ${order.id}` } });
        }
    });
    return prisma.posPayment.findUniqueOrThrow({ where: { id: order.id }, include: includeSale });
}
export function posPaymentView(order: Order) {
    return { idempotencyKey: order.requestKey.slice(order.shopId.length + 1), id: order.id, saleId: order.saleId, receiptNumber: order.sale.receiptNumber, amount: order.sale.payableAmount, paymentUrl: order.paymentUrl, status: order.status, createdAt: order.createdAt };
}
