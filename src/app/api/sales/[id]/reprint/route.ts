import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
      "CASHIER",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;

    const sale = await prisma.sale.findFirst({
      where: {
        id: params.id,
        shopId,
      },
      include: {
        shop: true,
        cashier: {
          select: { id: true, fullName: true, username: true },
        },
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Chek / Sotuv topilmadi" } },
        { status: 404 }
      );
    }

    // Cashier can only reprint their own receipt unless admin
    if (user.role === "CASHIER" && sale.cashierId !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Kassir faqat o‘zining sotuv cheklarini qayta chop etishi mumkin.",
          },
        },
        { status: 403 }
      );
    }

    // Record reprint in audit log
    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "CHEK_QAYTA_CHOP_ETILDI",
      entity: "Sale",
      entityId: sale.id,
      details: `Chek #${sale.receiptNumber} (${sale.payableAmount} so'm) qayta chop etildi.`,
    });

    return NextResponse.json({
      success: true,
      message: "Chek qayta chop etish uchun tayyorlandi",
      data: {
        ...sale,
        shopName: sale.shop.name,
        shopPhone: sale.shop.phone,
        shopAddress: sale.shop.address,
        cashierName: sale.cashier.fullName,
        items: sale.items.map((i) => ({
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
          totalPrice: i.totalPrice,
        })),
      },
    });
  } catch (error: any) {
    logger.error("Sale reprint error", { error: error });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "Xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}
