import { Prisma } from "@prisma/client";
import { z } from "zod";
import { saleSchema } from "@/lib/validations";
import { TenantContext } from "@/lib/tenant";
import { generateReceiptNumber } from "@/lib/receipt";
export async function recordSale(tx: Prisma.TransactionClient, validated: z.infer<typeof saleSchema>, context: TenantContext, pendingPayment = false) {
    const { shopId, user } = context;
    const { customerId, paymentMethod, discountAmount, paidAmount, items, notes, idempotencyKey } = validated;
    // Fetch shop details for receipt
    const shop = await tx.shop.findUnique({
        where: { id: shopId },
    });
    if (!shop)
        throw new Error("Do‘kon topilmadi");
    const now = new Date();
    const receiptNumber = await generateReceiptNumber(shopId);
    // Run atomic transaction
    // 1. Validate batches, expiry, and calculate total gross
    let totalAmount = 0;
    const validatedItems: Array<{
        productId: string;
        batchId: string;
        batchNumber: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        totalPrice: number;
        purchasePrice: number;
        productName: string;
    }> = [];
    for (const item of items) {
        const batch = await tx.productBatch.findFirst({
            where: {
                id: item.batchId,
                shopId,
            },
            include: {
                product: true,
            },
        });
        if (!batch || batch.productId !== item.productId || batch.product.status !== "ACTIVE") {
            throw new Error(`Partiya topilmadi yoki ushbu do‘konga tegishli emas`);
        }
        if (pendingPayment && (item.unitPrice !== batch.product.salePrice || item.discount !== 0)) {
            throw new Error("Mahsulot narxi yangilangan. Katalogni yangilang");
        }
        // Check if expired
        if (new Date(batch.expiryDate) <
            (validated.occurredAt
                ? new Date(validated.occurredAt)
                : now)) {
            throw new Error(`"${batch.product.name}" (Partiya #${batch.batchNumber}) ning yaroqlilik muddati tugagan (${new Date(batch.expiryDate).toLocaleDateString("uz-UZ")})! Muddati tugagan mahsulotni sotish qat'iyan taqiqlangan.`);
        }
        // Check stock availability
        if (batch.currentQuantity < item.quantity) {
            throw new Error(`"${batch.product.name}" partiyasida qoldiq yetarli emas! Mavjud: ${batch.currentQuantity} ta, so‘ralgan: ${item.quantity} ta.`);
        }
        const itemTotal = Math.round(item.unitPrice * item.quantity - item.discount);
        totalAmount += Math.round(item.unitPrice * item.quantity);
        validatedItems.push({
            productId: batch.productId,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            quantity: item.quantity,
            unitPrice: Math.round(item.unitPrice),
            discount: Math.round(item.discount),
            totalPrice: itemTotal,
            purchasePrice: batch.purchasePrice,
            productName: batch.product.name,
        });
    }
    if (customerId && !await tx.customer.findFirst({ where: { id: customerId, shopId } }))
        throw new Error("Mijoz bu do‘konga tegishli emas");
    // 2. Validate discount
    if (discountAmount > totalAmount) {
        throw new Error("Chegirma summasi savatdagi umumiy qiymatdan oshishi mumkin emas!");
    }
    // Cashier role max discount restriction (max 15%)
    if (user.role === "CASHIER" && totalAmount > 0) {
        const discountPct = (discountAmount / totalAmount) * 100;
        if (discountPct > 15) {
            throw new Error(`Kassir uchun ruxsat etilgan maksimal chegirma 15%. Kiritilgan: ${discountPct.toFixed(1)}%. Chegirmali sotish uchun administrator ruxsati kerak.`);
        }
    }
    // Tax calculation based on shop settings
    const shopTaxRate = shop.taxRate || 0;
    const taxIncluded = shop.taxIncluded || false;
    let taxAmount = 0;
    let payableAmount = 0;
    if (shopTaxRate > 0) {
        if (taxIncluded) {
            payableAmount = Math.max(0, Math.round(totalAmount - discountAmount));
            taxAmount = Math.round(payableAmount - payableAmount / (1 + shopTaxRate / 100));
        }
        else {
            const afterDiscount = Math.max(0, totalAmount - discountAmount);
            taxAmount = Math.round(afterDiscount * (shopTaxRate / 100));
            payableAmount = Math.round(afterDiscount + taxAmount);
        }
    }
    else {
        payableAmount = Math.max(0, Math.round(totalAmount - discountAmount));
    }
    if (validated.expectedTotal !== undefined &&
        Math.abs(validated.expectedTotal - payableAmount) > 0.5) {
        throw new Error("Telefondagi summa server hisobiga mos emas. Savdoni administrator tekshirishi kerak.");
    }
    // 3. Strict Payment Validation (paid amount cannot be less than total)
    if (!pendingPayment && paidAmount < payableAmount) {
        throw new Error(`To’langan summa (${Math.round(paidAmount).toLocaleString("uz-UZ")} so’m) to’lov summasidan (${payableAmount.toLocaleString("uz-UZ")} so’m) kam bo’lishi mumkin emas!`);
    }
    const changeAmount = pendingPayment ? 0 : Math.max(0, Math.round(paidAmount - payableAmount));
    // 4. Create Sale Record
    const sale = await tx.sale.create({
        data: {
            shopId,
            receiptNumber,
            ...(validated.occurredAt
                ? { createdAt: new Date(validated.occurredAt) }
                : {}),
            idempotencyKey: idempotencyKey || null,
            cashierId: user.id,
            customerId: customerId || null,
            totalAmount,
            discountAmount: Math.round(discountAmount),
            taxRate: shopTaxRate,
            taxAmount,
            payableAmount,
            paidAmount: pendingPayment ? 0 : Math.round(paidAmount),
            changeAmount,
            paymentMethod,
            status: pendingPayment ? "AWAITING_PAYMENT" : "COMPLETED",
            notes: notes || null,
        },
    });
    // 5. Atomic Stock Decrement & Transaction Log
    for (const item of validatedItems) {
        await tx.saleItem.create({
            data: {
                saleId: sale.id,
                productId: item.productId,
                batchId: item.batchId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                totalPrice: item.totalPrice,
                purchasePrice: item.purchasePrice,
            },
        });
        // ATOMIC stock decrement with conditional check to eliminate race conditions
        const updateResult = await tx.productBatch.updateMany({
            where: {
                id: item.batchId,
                shopId,
                currentQuantity: { gte: item.quantity },
            },
            data: {
                currentQuantity: { decrement: item.quantity },
            },
        });
        if (updateResult.count === 0) {
            throw new Error(`"${item.productName}" (Partiya #${item.batchNumber}) omborda yetarli emas yoki ayni vaqtda boshqa kassir tomonidan sotildi! Savdo bekor qilindi.`);
        }
        // Create outflow audit transaction
        await tx.inventoryTransaction.create({
            data: {
                shopId,
                productId: item.productId,
                batchId: item.batchId,
                type: "OUTFLOW_SALE",
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                createdById: user.id,
                notes: `Sotuv: Chek #${receiptNumber}`,
            },
        });
        // Check if product remaining total stock is below minStock
        const allBatches = await tx.productBatch.findMany({
            where: { productId: item.productId, shopId },
        });
        const currentTotalStock = allBatches.reduce((acc, b) => acc + b.currentQuantity, 0);
        const product = await tx.product.findUnique({
            where: { id: item.productId },
        });
        if (product && currentTotalStock <= product.minStock) {
            const refKey = `LOW_STOCK_${item.productId}`;
            await tx.notification.upsert({
                where: {
                    shopId_type_referenceKey: {
                        shopId,
                        type: "LOW_STOCK",
                        referenceKey: refKey,
                    },
                },
                update: {
                    message: `Diqqat: "${product.name}" mahsulotining umumiy qoldig'i ${currentTotalStock} ${product.unit} qoldi (minimal chegara: ${product.minStock}).`,
                },
                create: {
                    shopId,
                    title: "Qoldiq kamaydi!",
                    message: `Diqqat: "${product.name}" mahsulotining umumiy qoldig'i ${currentTotalStock} ${product.unit} qoldi (minimal chegara: ${product.minStock}).`,
                    type: "LOW_STOCK",
                    referenceKey: refKey,
                },
            });
        }
    }
    // 6. Create Payment record
    if (!pendingPayment)
        await tx.payment.create({
            data: {
                shopId,
                saleId: sale.id,
                amount: payableAmount,
                paymentMethod,
                status: "SUCCESS",
            },
        });
    // 7. Update customer statistics
    if (customerId && !pendingPayment) {
        await tx.customer.update({
            where: { id: customerId },
            data: {
                totalSpent: { increment: payableAmount },
                purchasesCount: { increment: 1 },
            },
        });
    }
    return {
        sale,
        shop,
        items: validatedItems,
    };
}
