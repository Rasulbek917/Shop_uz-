import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN", "WAREHOUSEMAN"]);
  if (errorResponse) return errorResponse;
  const { shopId } = context!;
  const productId = req.nextUrl.searchParams.get("productId") || undefined;
  if (productId && !/^[a-f0-9-]{36}$/i.test(productId)) return NextResponse.json({ success: false, error: "Mahsulot ID noto‘g‘ri" }, { status: 400 });
  const data = await prisma.inventoryTransaction.findMany({ where: { shopId, ...(productId ? { productId } : {}) }, include: { product: { select: { name: true, unit: true } }, batch: { select: { batchNumber: true } }, createdBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ success: true, data });
}
