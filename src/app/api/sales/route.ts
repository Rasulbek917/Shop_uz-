import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { saleSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { saleReplay, assertReplay } from "@/lib/sale-replay";
import { recordSale } from "@/lib/record-sale";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const cashierId = req.nextUrl.searchParams.get("cashierId");
    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");
    const receiptNumber = req.nextUrl.searchParams.get("receiptNumber");

    const where: any = {
      shopId,
      status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] },
    };

    if (receiptNumber) {
      where.receiptNumber = {
        contains: receiptNumber.trim(),
        mode: "insensitive",
      };
    } else {
      // If role is CASHIER and not doing a specific receipt search, cashier views their own sales
      if (user.role === "CASHIER") {
        where.cashierId = user.id;
      } else if (cashierId) {
        where.cashierId = cashierId;
      }
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        cashier: {
          select: { id: true, fullName: true, username: true },
        },
        customer: {
          select: { id: true, name: true, phone: true },
        },
        items: {
          include: {
            product: true,
            batch: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: sales });
  } catch (error: any) {
    logger.error("Sales GET error", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Savdolarni yuklashda xatolik yuz berdi",
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let replay: { shopId: string; key: string; input: any } | null = null;
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
      "CASHIER",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const body = await req.json();
    const validated = saleSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              validated.error.errors[0]?.message || "Xato sotuv ma'lumotlari",
          },
        },
        { status: 400 },
      );
    }

    const {
      customerId,
      paymentMethod,
      discountAmount,
      paidAmount,
      items,
      notes,
      idempotencyKey,
    } = validated.data;

    if (idempotencyKey) {
      replay = { shopId, key: idempotencyKey, input: validated.data };
      const existing = await saleReplay(shopId, idempotencyKey);
      if (existing) {
        assertReplay(existing, validated.data);
        return NextResponse.json({ success: true, data: existing });
      }
    }

    if (paymentMethod === "ELECTRONIC") {
      return NextResponse.json({ success: false, error: "Elektron to‘lov uchun POS Tezcheck to‘lov oynasidan foydalaning" }, { status: 409 });
    }
    const result = await prisma.$transaction(tx => recordSale(tx, validated.data, context!));
    const shop = result.shop;
    const receiptNumber = result.sale.receiptNumber;

    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "SOTUV_QILINDI",
      entity: "Sale",
      entityId: result.sale.id,
      details: `Chek #${receiptNumber}: ${result.sale.payableAmount} so'm (${result.sale.paymentMethod})`,
    });

    return NextResponse.json({
      success: true,
      message: "Sotuv muvaffaqiyatli yakunlandi",
      data: {
        ...result.sale,
        shopName: shop.name,
        shopPhone: shop.phone,
        shopAddress: shop.address,
        cashierName: user.fullName,
        items: result.items,
      },
    });
  } catch (error: any) {
    if (replay && error?.code === "P2002") {
      const existing = await saleReplay(replay.shopId, replay.key);
      if (existing) {
        try {
          assertReplay(existing, replay.input);
          return NextResponse.json({ success: true, data: existing });
        } catch (conflict) {
          return NextResponse.json(
            { success: false, error: (conflict as Error).message },
            { status: 409 },
          );
        }
      }
    }
    logger.error("Sale POST error", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SALE_EXECUTION_ERROR",
          message: error.message || "Sotuvni yakunlashda xatolik yuz berdi",
        },
      },
      { status: 400 },
    );
  }
}
