import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { platformError } from "@/lib/platform-api";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiAuth(req); if (auth.errorResponse) return auth.errorResponse;
    const shop = auth.user.shopId ? await prisma.shop.findUnique({ where: { id: auth.user.shopId }, include: {
      purchaseRequests: { orderBy: { createdAt: "desc" }, take: 20 },
      checkoutOrders: { orderBy: { createdAt: "desc" }, take: 20, select: {
        id: true, planCode: true, amount: true, status: true, createdAt: true, paidAt: true,
      } },
    } }) : null;
    return NextResponse.json({ success: true, data: { user: auth.user, shop, plans: await prisma.plan.findMany() } });
  } catch (e) { return platformError(e); }
}
