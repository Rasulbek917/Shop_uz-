import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { reconcileCheckout } from "@/lib/payments/tezcheck";
import { platformError } from "@/lib/platform-api";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireApiAuth(req, ["SHOP_ADMIN"]);
    if (auth.errorResponse) return auth.errorResponse;
    const order = await prisma.checkoutOrder.findFirst({ where: { id: params.id, shopId: auth.user.shopId || "" }, select: { id: true } });
    if (!order) return NextResponse.json({ success: false, error: "To‘lov topilmadi" }, { status: 404 });
    return NextResponse.json({ success: true, data: await reconcileCheckout(order.id) });
  } catch (error) { return platformError(error); }
}
