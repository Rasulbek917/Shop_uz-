import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

const inputSchema = z.object({
  batchId: z.string().uuid(),
  countedQuantity: z.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(3).max(300),
});

export async function POST(req: NextRequest) {
  const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN", "WAREHOUSEMAN"]);
  if (errorResponse) return errorResponse;
  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Ma’lumot noto‘g‘ri" }, { status: 400 });
  const { shopId, user } = context!;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.productBatch.findFirst({ where: { id: parsed.data.batchId, shopId }, include: { product: { select: { name: true } } } });
      if (!batch) throw new Error("Partiya topilmadi");
      const previous = batch.currentQuantity;
      const delta = parsed.data.countedQuantity - previous;
      if (delta === 0) return { batch, previous, delta };
      const changed = await tx.productBatch.updateMany({ where: { id: batch.id, shopId, currentQuantity: previous }, data: { currentQuantity: parsed.data.countedQuantity } });
      if (changed.count !== 1) throw new Error("Qoldiq boshqa joyda o‘zgardi. Sahifani yangilang");
      await tx.inventoryTransaction.create({ data: { shopId, productId: batch.productId, batchId: batch.id, type: "ADJUSTMENT", quantity: delta, unitPrice: batch.purchasePrice, createdById: user.id, notes: `Inventarizatsiya: ${previous} → ${parsed.data.countedQuantity}. ${parsed.data.reason}` } });
      return { batch, previous, delta };
    });
    if (result.delta !== 0) await logAudit({ shopId, userId: user.id, userName: user.fullName, action: "OMBOR_INVENTARIZATSIYA", entity: "ProductBatch", entityId: result.batch.id, details: `${result.batch.product.name}: ${result.previous} → ${parsed.data.countedQuantity}; ${parsed.data.reason}` });
    return NextResponse.json({ success: true, data: { batchId: result.batch.id, previousQuantity: result.previous, currentQuantity: parsed.data.countedQuantity, difference: result.delta } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Qoldiq saqlanmadi" }, { status: 409 });
  }
}
