import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> }
) {
  const params = await pendingParams;
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, shopId },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            cashier: {
              select: { fullName: true },
            },
            items: {
              include: { product: { select: { name: true, unit: true } } },
            },
            returns: { select: { id: true, totalRefundAmount: true, loyaltyPointsReversed: true, loyaltyPointsRestored: true, createdAt: true } },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: "Mijoz topilmadi" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    logger.error("GET /api\customers\:id\route.ts xatolik", { error: error, route: "/api\customers\:id\route.ts" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params: pendingParams }: { params: Promise<{ id: string }> }) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN", "SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;
    const { id } = await pendingParams;
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 120) return NextResponse.json({ success: false, error: "Ism 2–120 belgi bo‘lishi kerak" }, { status: 400 });
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (phone.length > 40 || notes.length > 500) return NextResponse.json({ success: false, error: "Telefon yoki izoh juda uzun" }, { status: 400 });
    const updated = await prisma.customer.updateMany({ where: { id, shopId: context!.shopId }, data: { name, phone: phone || null, notes: notes || null } });
    if (!updated.count) return NextResponse.json({ success: false, error: "Mijoz topilmadi" }, { status: 404 });
    return NextResponse.json({ success: true, data: await prisma.customer.findFirst({ where: { id, shopId: context!.shopId } }) });
  } catch (error) {
    logger.error("Customer update error", { error });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}
