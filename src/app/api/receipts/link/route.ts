import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { receiptUrl } from "@/lib/receipt-share";
import { platformError } from "@/lib/platform-api";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
      "CASHIER",
    ]);
    if (errorResponse) return errorResponse;
    const receiptNumber = z
      .string()
      .min(1)
      .max(100)
      .parse(req.nextUrl.searchParams.get("receiptNumber"));
    const { user, shopId } = context!;
    const sale = await prisma.sale.findFirst({
      where: {
        receiptNumber,
        shopId,
        ...(user.role === "CASHIER" ? { cashierId: user.id } : {}),
      },
      select: { id: true },
    });
    if (!sale)
      return NextResponse.json(
        { success: false, error: "Chek topilmadi" },
        { status: 404 },
      );
    return NextResponse.json(
      { success: true, data: { url: receiptUrl(sale.id) } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return platformError(error);
  }
}
