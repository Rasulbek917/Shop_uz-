import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Helper to generate a safe, unique, compact product QR code string
function generateUniqueProductCode(shopId: string, productId: string): string {
  // Safe format: PRD-<shortShopId>-<shortRandom>-<timestampSuffix>
  const shortId = productId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const timeCode = Date.now().toString(36).slice(-4).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PRD-${shortId}-${timeCode}${randomSuffix}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
      "WAREHOUSEMAN",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const body = await req.json().catch(() => ({}));
    const regenerate = Boolean(body.regenerate);

    // 1. Verify product belongs to tenant
    const product = await prisma.product.findFirst({
      where: {
        id: params.id,
        shopId,
      },
      include: {
        category: true,
        manufacturer: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Mahsulot topilmadi" } },
        { status: 404 }
      );
    }

    // 2. If QR code already exists and not regenerating, return existing
    if (product.qrCode && !regenerate) {
      return NextResponse.json({
        success: true,
        message: "Mavjud QR kod yuklandi",
        qrCode: product.qrCode,
        product,
      });
    }

    // 3. Generate unique code
    let newQrCode = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      newQrCode = generateUniqueProductCode(shopId, product.id);
      const existing = await prisma.product.findFirst({
        where: {
          shopId,
          qrCode: newQrCode,
          id: { not: product.id },
        },
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "GENERATION_FAILED", message: "Unikal QR kod yaratib bo‘lmadi. Qayta urinib ko‘ring." },
        },
        { status: 500 }
      );
    }

    // 4. Update product with new QR code
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { qrCode: newQrCode },
      include: {
        category: true,
        manufacturer: true,
      },
    });

    // 5. Audit log
    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: regenerate ? "QR_QAYTA_YARATILDI" : "QR_YARATILDI",
      entity: "Product",
      entityId: product.id,
      details: `${product.name} uchun yangi QR kod generatsiya qilindi (${newQrCode})`,
    });

    return NextResponse.json({
      success: true,
      message: regenerate ? "QR kod muvaffaqiyatli yangilandi" : "QR kod muvaffaqiyatli yaratildi",
      qrCode: newQrCode,
      product: updated,
    });
  } catch (error) {
    logger.error("Generate QR error", { error: error });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "QR kod yaratishda xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}
