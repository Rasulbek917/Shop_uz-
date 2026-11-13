import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { receiptFilters } from "@/lib/receipt-filters";
import { platformError } from "@/lib/platform-api";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
    ]);
    if (errorResponse) return errorResponse;
    const { where } = receiptFilters(req.nextUrl.searchParams, context!.shopId);
    const groups = await prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: { ...where, status: "COMPLETED" },
      _sum: { payableAmount: true },
      _count: { _all: true },
    });
    return NextResponse.json({
      success: true,
      data: groups.map((group) => ({
        paymentMethod: group.paymentMethod,
        amount: group._sum.payableAmount || 0,
        count: group._count._all,
      })),
    });
  } catch (error) {
    return platformError(error);
  }
}
