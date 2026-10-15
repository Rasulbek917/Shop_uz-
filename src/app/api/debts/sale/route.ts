import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { debtSaleSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POS'dagi "Qarzga sotish" amali:
//  - ombordan mahsulot kamayadi (inventar harakati yoziladi)
//  - sotib olingan mahsulot nomlari tavsifda saqlanadi
//  - umumiy summa "Qarzlar" bo'limiga qarz sifatida tushadi
export async function POST(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
      "CASHIER",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const body = await req.json();
    const validated = debtSaleSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.errors[0]?.message || "Xato ma'lumotlar" },
        { status: 400 }
      );
    }

    const { firstName, lastName, phone, discountAmount, notes, items } = validated.data;

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return NextResponse.json(
        { success: false, error: "Do‘kon topilmadi" },
        { status: 404 }
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Partiyalarni tekshirish, muddat va qoldiqni nazorat qilish
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
        unit: string;
      }> = [];

      for (const item of items) {
        const batch = await tx.productBatch.findFirst({
          where: { id: item.batchId, shopId },
          include: { product: true },
        });

        if (!batch) {
          throw new Error("Partiya topilmadi yoki ushbu do‘konga tegishli emas");
        }

        if (new Date(batch.expiryDate) < now) {
          throw new Error(
            `"${batch.product.name}" (Partiya #${batch.batchNumber}) ning yaroqlilik muddati tugagan!`
          );
        }

        if (batch.currentQuantity < item.quantity) {
          throw new Error(
            `"${batch.product.name}" partiyasida qoldiq yetarli emas! Mavjud: ${batch.currentQuantity} ta, so‘ralgan: ${item.quantity} ta.`
          );
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
          unit: batch.product.unit,
        });
      }

      // 2. Chegirmani tekshirish
      if (discountAmount > totalAmount) {
        throw new Error("Chegirma summasi savatdagi umumiy qiymatdan oshishi mumkin emas!");
      }

      if (user.role === "CASHIER" && totalAmount > 0) {
        const discountPct = (discountAmount / totalAmount) * 100;
        if (discountPct > 15) {
          throw new Error(
            `Kassir uchun ruxsat etilgan maksimal chegirma 15%. Kiritilgan: ${discountPct.toFixed(1)}%.`
          );
        }
      }

      // 3. Soliq hisob-kitobi (sotuv bilan bir xil mantiq)
      const shopTaxRate = shop.taxRate || 0;
      const taxIncluded = shop.taxIncluded || false;
      let taxAmount = 0;
      let payableAmount = 0;

      if (shopTaxRate > 0) {
        if (taxIncluded) {
          payableAmount = Math.max(0, Math.round(totalAmount - discountAmount));
          taxAmount = Math.round(payableAmount - payableAmount / (1 + shopTaxRate / 100));
        } else {
          const afterDiscount = Math.max(0, totalAmount - discountAmount);
          taxAmount = Math.round(afterDiscount * (shopTaxRate / 100));
          payableAmount = Math.round(afterDiscount + taxAmount);
        }
      } else {
        payableAmount = Math.max(0, Math.round(totalAmount - discountAmount));
      }

      // 4. Tavsifga sotib olingan mahsulot nomlarini yozamiz
      const itemLines = validatedItems
        .map(
          (it, idx) =>
            `${idx + 1}) ${it.productName} — ${it.quantity} ${it.unit} × ${it.unitPrice.toLocaleString(
              "uz-UZ"
            )} = ${it.totalPrice.toLocaleString("uz-UZ")} so‘m`
        )
        .join("; ");

      let description = `Qarzga sotuv: ${itemLines}`;
      if (discountAmount > 0) {
        description += ` | Chegirma: ${Math.round(discountAmount).toLocaleString("uz-UZ")} so‘m`;
      }
      if (notes && notes.trim()) {
        description += ` | Izoh: ${notes.trim()}`;
      }

      // 5. Qarz yozuvi
      const debt = await tx.debt.create({
        data: {
          shopId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone?.trim() || null,
          amount: payableAmount,
          description,
          status: "OPEN",
        },
      });

      // 6. Ombordan kamaytirish + inventar harakati
      for (const item of validatedItems) {
        const updateResult = await tx.productBatch.updateMany({
          where: {
            id: item.batchId,
            shopId,
            currentQuantity: { gte: item.quantity },
          },
          data: { currentQuantity: { decrement: item.quantity } },
        });

        if (updateResult.count === 0) {
          throw new Error(
            `"${item.productName}" (Partiya #${item.batchNumber}) omborda yetarli emas!`
          );
        }

        await tx.inventoryTransaction.create({
          data: {
            shopId,
            productId: item.productId,
            batchId: item.batchId,
            type: "OUTFLOW_SALE",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            createdById: user.id,
            notes: `Qarzga sotuv: ${firstName.trim()} ${lastName.trim()}`,
          },
        });

        // Kam qoldiq bo'yicha ogohlantirish
        const allBatches = await tx.productBatch.findMany({
          where: { productId: item.productId, shopId },
        });
        const currentTotalStock = allBatches.reduce((acc, b) => acc + b.currentQuantity, 0);

        const product = await tx.product.findUnique({ where: { id: item.productId } });

        if (product && currentTotalStock <= product.minStock) {
          const refKey = `LOW_STOCK_${item.productId}`;
          await tx.notification.upsert({
            where: {
              shopId_type_referenceKey: { shopId, type: "LOW_STOCK", referenceKey: refKey },
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

      // 7. Mijoz statistikasi (agar bog'langan mijoz bo'lsa)
      if (validated.data.customerId) {
        await tx.customer.update({
          where: { id: validated.data.customerId },
          data: { purchasesCount: { increment: 1 } },
        });
      }

      return { debt, items: validatedItems, totalAmount, payableAmount, taxAmount };
    });

    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "QARZGA_SOTUV_QILINDI",
      entity: "Debt",
      entityId: result.debt.id,
      details: `${firstName} ${lastName} nomiga ${result.payableAmount} so'm qarzga sotildi`,
    });

    return NextResponse.json({
      success: true,
      message: "Qarzga sotuv muvaffaqiyatli saqlandi",
      data: {
        id: result.debt.id,
        firstName: result.debt.firstName,
        lastName: result.debt.lastName,
        phone: result.debt.phone,
        amount: result.debt.amount,
        description: result.debt.description,
        status: result.debt.status,
        items: result.items,
      },
    });
  } catch (error: any) {
    logger.error("Debt sale POST error", { error: error });
    return NextResponse.json(
      { success: false, error: error.message || "Qarzga sotishda xatolik yuz berdi" },
      { status: 400 }
    );
  }
}
