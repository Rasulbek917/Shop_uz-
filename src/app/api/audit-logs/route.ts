import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const action = req.nextUrl.searchParams.get("action");
    const entity = req.nextUrl.searchParams.get("entity");

    const where: any = {};
    if (user.role !== "SUPER_ADMIN") {
      where.shopId = shopId;
    } else {
      const qShopId = req.nextUrl.searchParams.get("shopId");
      if (qShopId) where.shopId = qShopId;
    }

    if (action) where.action = action;
    if (entity) where.entity = entity;

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        shop: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    logger.error("GET /api/audit-logs xatolik", { error, route: "/api/audit-logs" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}
