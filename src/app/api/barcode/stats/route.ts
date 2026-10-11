import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId, user } = context!;
    const isSuperAdmin = user.role === "SUPER_ADMIN" && !shopId;

    const baseWhere: any = isSuperAdmin ? {} : { shopId };

    const [
      totalProducts,
      qrCount,
      barcodeCount,
      activeCount,
      recentProducts,
    ] = await Promise.all([
      prisma.product.count({ where: baseWhere }),
      prisma.product.count({
        where: {
          ...baseWhere,
          qrCode: { not: null },
        },
      }),
      prisma.product.count({
        where: {
          ...baseWhere,
          barcode: { not: null },
        },
      }),
      prisma.product.count({
        where: {
          ...baseWhere,
          status: "ACTIVE",
        },
      }),
      prisma.product.findMany({
        where: baseWhere,
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          shop: { select: { name: true } },
          category: { select: { name: true } },
          manufacturer: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalProducts,
        qrCount,
        barcodeCount,
        activeCount,
        recentProducts,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: "Statistika yuklashda xatolik: " + error.message } },
      { status: 500 }
    );
  }
}
