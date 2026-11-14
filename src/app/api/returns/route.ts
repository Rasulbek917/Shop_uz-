import { createHash } from "crypto";
import { withRefundInfo, refundForQuantity } from "@/lib/refunds";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { returnSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;

    const returns = await prisma.return.findMany({
      where: { shopId },
      include: {
        returnedBy: {
          select: { fullName: true, username: true },
        },
        items: {
          include: {
            product: true,
            batch: true,
          },
        },
        sale: {
          select: { receiptNumber: true, paymentMethod: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: returns });
  } catch (error: any) {
    logger.error("Returns GET error", { error: error });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "Qaytarishlarni yuklashda xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, ["SUPER_ADMIN", "SHOP_ADMIN", "CASHIER"]);
    if (errorResponse) return errorResponse;
    const { user, shopId } = context!;
    const parsed = returnSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Qaytarish ma’lumotlarini tekshiring" }, { status: 400 });
    const input = parsed.data;
    const requestKey = input.idempotencyKey ? `${shopId}:${input.idempotencyKey}` : null;
    const requestHash = createHash("sha256").update(JSON.stringify({
      saleId: input.saleId,
      reason: input.reason || "",
      items: [...input.items].sort((a, b) => a.saleItemId.localeCompare(b.saleItemId)),
    })).digest("hex");

    const result = await prisma.$transaction(async tx => {
      // Serialize returns for this receipt before reading prior returned quantities.
      const locked = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Sale" WHERE "id" = ${input.saleId} AND "shopId" = ${shopId} FOR UPDATE`;
      if (!locked.length || locked[0].status !== "COMPLETED") throw new Error("Yakunlangan savdo cheki topilmadi");
      if (requestKey) {
        const existing = await tx.return.findUnique({ where: { idempotencyKey: requestKey } });
        if (existing) {
          if (existing.requestHash !== requestHash) throw new Error("Bu qaytarish raqami boshqa so‘rovda ishlatilgan");
          return existing;
        }
      }
      const original = await tx.sale.findFirstOrThrow({ where: { id: input.saleId, shopId }, include: { items: true, returns: { include: { items: true } } } });
      const sale = withRefundInfo(original);
      const quoted = input.items.map(item => {
        const sold = sale.items.find(row => row.id === item.saleItemId);
        if (!sold || sold.productId !== item.productId || sold.batchId !== item.batchId) throw new Error("Mahsulot va partiya asl chek qatoriga mos emas");
        if (item.quantity > sold.returnableQuantity) throw new Error(`Qaytarish mumkin bo‘lgan qoldiq ${sold.returnableQuantity} ta`);
        if (item.refundUnitPrice > sold.unitPrice) throw new Error("Qaytarish narxi asl chekdagi narxdan yuqori bo‘la olmaydi");
        const maximum = refundForQuantity(sold, item.quantity);
        const amount = sold.unitPrice > 0 ? Math.round(maximum * (item.refundUnitPrice / sold.unitPrice)) : 0;
        return { ...item, totalRefund: amount, refundUnitPrice: amount / item.quantity };
      });
      const totalRefundAmount = quoted.reduce((sum, item) => sum + item.totalRefund, 0);
      const priorRefundAmount = original.returns.reduce((sum, record) => sum + record.totalRefundAmount, 0);
      if (totalRefundAmount + priorRefundAmount > sale.payableAmount) throw new Error("Qaytarish summasi chek summasidan oshdi");

      let creditAdjustment = 0;
      let cashRefundAmount = totalRefundAmount;
      if (sale.paymentMethod === "DEBT") {
        const debt = sale.idempotencyKey ? await tx.debt.findFirst({ where: { shopId, clientReference: sale.idempotencyKey } }) : null;
        if (!debt) throw new Error("Eski nasiya cheki qarz yozuviga bog‘lanmagan. Administrator avval qarzni tekshirishi kerak");
        await tx.$queryRaw`SELECT "id" FROM "Debt" WHERE "id" = ${debt.id} FOR UPDATE`;
        const current = await tx.debt.findUniqueOrThrow({ where: { id: debt.id } });
        creditAdjustment = current.status === "OPEN" ? Math.min(current.amount, totalRefundAmount) : 0;
        cashRefundAmount = current.status === "CANCELLED" ? 0 : totalRefundAmount - creditAdjustment;
        if (creditAdjustment > 0) {
          const remaining = Math.max(0, current.amount - creditAdjustment);
          await tx.debt.update({ where: { id: debt.id }, data: { amount: remaining, status: remaining === 0 ? "CANCELLED" : "OPEN" } });
        }
      }
      const record = await tx.return.create({ data: {
        shopId, saleId: sale.id, receiptNumber: sale.receiptNumber, returnedById: user.id,
        totalRefundAmount, cashRefundAmount, creditAdjustment, idempotencyKey: requestKey, requestHash,
        reason: input.reason || "Mijoz xohishi bilan qaytarildi",
      } });
      for (const item of quoted) {
        await tx.returnItem.create({ data: { ...item, returnId: record.id } });
        const restored = await tx.productBatch.updateMany({ where: { id: item.batchId, shopId }, data: { currentQuantity: { increment: item.quantity } } });
        if (restored.count !== 1) throw new Error("Asl partiya topilmadi");
        await tx.inventoryTransaction.create({ data: {
          shopId, productId: item.productId, batchId: item.batchId, type: "INFLOW_RETURN", quantity: item.quantity,
          unitPrice: item.refundUnitPrice, createdById: user.id, notes: `Qaytarish: ${sale.receiptNumber}`,
        } });
      }
      if (sale.customerId && sale.paymentMethod !== "DEBT") {
        await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${sale.customerId} AND "shopId" = ${shopId} FOR UPDATE`;
        const customer = await tx.customer.findFirst({ where: { id: sale.customerId, shopId } });
        if (!customer) throw new Error("Mijoz ushbu do‘konga tegishli emas");
        await tx.customer.update({ where: { id: customer.id }, data: { totalSpent: Math.max(0, customer.totalSpent - totalRefundAmount) } });
      }
      return record;
    }, { timeout: 15000 });

    await logAudit({ shopId, userId: user.id, userName: user.fullName, action: "QAYTARISH_QILINDI", entity: "Return", entityId: result.id, details: `Chek ${result.receiptNumber}: ${result.totalRefundAmount} so‘m, qarz kamayishi ${result.creditAdjustment} so‘m` });
    const message = result.creditAdjustment > 0
      ? `Qaytarish saqlandi. Qarz ${result.creditAdjustment.toLocaleString("uz-UZ")} so‘mga kamaydi. Qaytariladigan pul ${(result.cashRefundAmount || 0).toLocaleString("uz-UZ")} so‘m.`
      : `Qaytarish saqlandi. Xaridorga qaytariladigan summa ${(result.cashRefundAmount ?? result.totalRefundAmount).toLocaleString("uz-UZ")} so‘m.`;
    return NextResponse.json({ success: true, message, data: result });
  } catch (error) {
    logger.error("Return error", { error });
    return NextResponse.json({ success: false, error: { code: "RETURN_ERROR", message: (error as Error).message || "Qaytarishda xatolik yuz berdi" } }, { status: 400 });
  }
}
