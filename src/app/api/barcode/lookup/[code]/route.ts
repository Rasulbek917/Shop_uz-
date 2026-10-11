import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;
    const rawCode = decodeURIComponent(params.code).trim();

    if (!rawCode) {
      return NextResponse.json(
        { success: false, error: { message: "Qidirish kodi ko'rsatilmadi" } },
        { status: 400 }
      );
    }

    // Lookup in current store
    const product = await prisma.product.findFirst({
      where: {
        shopId,
        OR: [
          { barcode: rawCode },
          { qrCode: rawCode },
          { id: rawCode },
        ],
      },
      include: {
        shop: { select: { name: true } },
        category: true,
        manufacturer: true,
        batches: {
          where: { currentQuantity: { gt: 0 } },
          orderBy: { expiryDate: "asc" },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `"${rawCode}" kodi bo'yicha do'koningizda mahsulot topilmadi`,
          },
        },
        { status: 404 }
      );
    }

    if (product.status === "INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PRODUCT_INACTIVE",
            message: `"${product.name}" mahsuloti nofaol (deaktivatsiya qilingan) holatda`,
          },
          product,
        },
        { status: 200 }
      );
    }

    const totalStock = product.batches.reduce((sum, b) => sum + b.currentQuantity, 0);
    const nearestBatch = product.batches[0] || null;

    return NextResponse.json({
      success: true,
      message: "Mahsulot muvaffaqiyatli topildi",
      product: {
        ...product,
        totalStock,
        nearestBatch,
        sku: product.barcode || product.qrCode || product.id,
        shopName: product.shop?.name || "Shop Market",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: "Qidiruvda xatolik: " + error.message } },
      { status: 500 }
    );
  }
}
