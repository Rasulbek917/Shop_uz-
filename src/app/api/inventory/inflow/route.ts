import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { inflowSchema } from "@/lib/validations";
import { getExpiryStatus } from "@/lib/formatters";

export const dynamic = "force-dynamic";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
      "WAREHOUSEMAN",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const body = await req.json();
    const validated = inflowSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.errors[0]?.message || "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const { productId, batchNumber, quantity, purchasePrice, salePrice, expiryDate, supplierId } =
      validated.data;

    // Verify product belongs to tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, shopId },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Tanlangan mahsulot topilmadi" },
        { status: 404 }
      );
    }

    const expDate = new Date(expiryDate);
    const { status: expiryStatus } = getExpiryStatus(expDate);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create product batch
      const batch = await tx.productBatch.create({
        data: {
          shopId,
          productId,
          batchNumber,
          initialQuantity: quantity,
          currentQuantity: quantity,
          purchasePrice,
          salePrice,
          expiryDate: expDate,
          supplierId: supplierId || null,
          status: expiryStatus,
        },
      });

      // 2. Create inventory transaction record
      await tx.inventoryTransaction.create({
        data: {
          shopId,
          productId,
          batchId: batch.id,
          type: "INFLOW",
          quantity,
          unitPrice: purchasePrice,
          createdById: user.id,
          notes: `Kirim: Partiya #${batchNumber}, Yaroqlilik: ${expDate.toLocaleDateString("uz-UZ")}`,
        },
      });

      // 3. Update product sale price if higher/updated
      if (salePrice > 0) {
        await tx.product.update({
          where: { id: productId },
          data: { salePrice },
        });
      }

      // 4. Update supplier debt if supplier provided
      if (supplierId) {
        const totalPurchaseCost = purchasePrice * quantity;
        await tx.supplier.update({
          where: { id: supplierId },
          data: {
            totalPurchases: { increment: totalPurchaseCost },
            debt: { increment: totalPurchaseCost },
          },
        });
      }

      return batch;
    });

    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "OMBORGA_KIRIM",
      entity: "ProductBatch",
      entityId: result.id,
      details: `${product.name} mahsulotdan ${quantity} ${product.unit} kirim qilindi (Partiya #${batchNumber})`,
    });

    return NextResponse.json({
      success: true,
      message: `Mahsulot muvaffaqiyatli omborga qo‘shildi: ${product.name} (+${quantity} ${product.unit})`,
      data: result,
    });
  } catch (error: any) {
    logger.error("Inflow error", { error: error });
    return NextResponse.json(
      { success: false, error: "Omborga kirim qilishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
