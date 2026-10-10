import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { productSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;
    const product = await prisma.product.findFirst({
      where: {
        id: params.id,
        shopId,
      },
      include: {
        category: true,
        manufacturer: true,
        batches: {
          orderBy: { expiryDate: "asc" },
          include: {
            supplier: true,
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            createdBy: {
              select: { fullName: true, role: true },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "Mahsulot topilmadi" }, { status: 404 });
    }

    const totalStock = product.batches.reduce((sum, b) => sum + b.currentQuantity, 0);

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        totalStock,
      },
    });
  } catch (error) {
    logger.error("GET /api/products/:id xatolik", { error, route: "/api/products/:id" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = await req.json();
    const validated = productSchema.partial().safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.errors[0]?.message || "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const currentMed = await prisma.product.findFirst({
      where: { id: params.id, shopId },
    });

    if (!currentMed) {
      return NextResponse.json({ success: false, error: "Mahsulot topilmadi" }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: validated.data,
    });

    if (validated.data.salePrice && validated.data.salePrice !== currentMed.salePrice) {
      await logAudit({
        shopId,
        userId: user.id,
        userName: user.fullName,
        action: "NARX_OZGARTIRILDI",
        entity: "Product",
        entityId: params.id,
        details: `${currentMed.name} narxi o‘zgartirildi: ${currentMed.salePrice} -> ${validated.data.salePrice} so'm`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Mahsulot muvaffaqiyatli tahrirlandi",
      data: updated,
    });
  } catch (error) {
    logger.error("PATCH /api/products/:id xatolik", { error, route: "/api/products/:id" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;

    const product = await prisma.product.findFirst({
      where: { id: params.id, shopId },
      include: { saleItems: true },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "Mahsulot topilmadi" }, { status: 404 });
    }

    // If product has sales, soft delete it
    if (product.saleItems.length > 0) {
      await prisma.product.update({
        where: { id: params.id },
        data: { status: "INACTIVE" },
      });
    } else {
      await prisma.product.delete({
        where: { id: params.id },
      });
    }

    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "MAHSULOT_OCHIRILDI",
      entity: "Product",
      entityId: params.id,
      details: `Mahsulot o‘chirildi: ${product.name}`,
    });

    return NextResponse.json({
      success: true,
      message: "Mahsulot muvaffaqiyatli o‘chirildi",
    });
  } catch (error) {
    logger.error("DELETE /api/products/:id xatolik", { error, route: "/api/products/:id" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}
