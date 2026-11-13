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
      "CASHIER",
    ]);
    if (errorResponse) return errorResponse;
    const { shopId, user } = context!;
    const { where, page } = receiptFilters(
      req.nextUrl.searchParams,
      shopId,
      user.role === "CASHIER" ? user.id : undefined,
    );
    const pageSize = 25;
    const [sales, total] = await prisma.$transaction([
      prisma.sale.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          receiptNumber: true,
          createdAt: true,
          payableAmount: true,
          paymentMethod: true,
          status: true,
        },
      }),
      prisma.sale.count({ where }),
    ]);
    return NextResponse.json({
      success: true,
      data: { sales, total, page, pageSize },
    });
  } catch (error) {
    return platformError(error);
  }
}
