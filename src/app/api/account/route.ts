import { PLAN_PRICES } from "@/lib/plans";
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { platformError } from "@/lib/platform-api";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req); if (auth.errorResponse) return auth.errorResponse;
  try {
    const shop = auth.user.shopId ? await prisma.shop.findUnique({ where: { id: auth.user.shopId }, include: { purchaseRequests: { orderBy: { createdAt: "desc" }, take: 20 } } }) : null;
    return NextResponse.json({ success: true, data: { user: auth.user, shop, plans: (await prisma.plan.findMany()).map(plan => ({ ...plan, price: PLAN_PRICES[plan.code as keyof typeof PLAN_PRICES] ?? plan.price })) } });
  } catch (e) { return platformError(e); }
}
