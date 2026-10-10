import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { productSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;
    const search = req.nextUrl.searchParams.get("search")?.trim() || "";
    const categoryId = req.nextUrl.searchParams.get("categoryId") || "";

    const where: any = {
      shopId,
      status: "ACTIVE",
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { barcode: { contains: search } },
        { qrCode: { contains: search } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        manufacturer: true,
        batches: {
          where: {
            currentQuantity: { gt: 0 },
          },
          orderBy: { expiryDate: "asc" }, // FEFO: nearest expiry first!
        },
      },
      orderBy: { name: "asc" },
    });

    const enriched = products.map((med) => {
      const totalStock = med.batches.reduce((sum, b) => sum + b.currentQuantity, 0);
      const nearestBatch = med.batches[0] || null;
      return {
        ...med,
        totalStock,
        nearestBatch,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    logger.error("Products GET error", { error: error });
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: "Xatolik yuz berdi" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
      "WAREHOUSEMAN",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const body = await req.json();
    const validated = productSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: validated.error.errors[0]?.message || "Xato ma'lumot" } },
        { status: 400 }
      );
    }

    const { name, barcode, qrCode, categoryId, manufacturerId, salePrice, minStock, unit, description } =
      validated.data;

    // Check barcode uniqueness if provided
    if (barcode) {
      const existing = await prisma.product.findFirst({
        where: {
          shopId,
          barcode,
          status: "ACTIVE",
        },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: "DUPLICATE_BARCODE", message: "Bu shtrix-kodga ega mahsulot tizimda allaqachon mavjud!" } },
          { status: 400 }
        );
      }
    }

    const product = await prisma.product.create({
      data: {
        shopId,
        name,
        barcode: barcode || null,
        qrCode: qrCode || null,
        categoryId: categoryId || null,
        manufacturerId: manufacturerId || null,
        salePrice,
        minStock,
        unit,
        description: description || null,
        status: "ACTIVE",
      },
    });

    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "MAHSULOT_QOSHILDI",
      entity: "Product",
      entityId: product.id,
      details: `Yangi mahsulot qo‘shildi: ${product.name} (Narxi: ${product.salePrice} so'm)`,
    });

    return NextResponse.json({
      success: true,
      message: "Mahsulot muvaffaqiyatli qo‘shildi",
      data: product,
    });
  } catch (error) {
    logger.error("Product POST error", { error: error });
    return NextResponse.json({ success: false, error: "Mahsulot qo‘shishda xatolik" }, { status: 500 });
  }
}
