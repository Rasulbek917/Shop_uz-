import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { receiptFilters, csvCell } from "@/lib/receipt-filters";
import { receiptDate } from "@/lib/formatters";
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
    const sales = await prisma.sale.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10001,
      select: {
        receiptNumber: true,
        createdAt: true,
        payableAmount: true,
        paymentMethod: true,
        status: true,
      },
    });
    if (sales.length > 10000)
      return NextResponse.json(
        {
          success: false,
          error:
            "10 000 tagacha chekni yuklash mumkin. Sana oralig‘ini qisqartiring.",
        },
        { status: 400 },
      );
    const rows = [
      [
        "Chek",
        "Sana va vaqt (Toshkent)",
        "Summa (so‘m)",
        "To‘lov turi",
        "Holati",
      ],
      ...sales.map((sale) => [
        sale.receiptNumber,
        receiptDate(sale.createdAt),
        sale.payableAmount,
        sale.paymentMethod,
        sale.status,
      ]),
    ];
    return new NextResponse(
      "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="savdoza-cheklar.csv"',
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return platformError(error);
  }
}
