import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { productSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { getExpiryStatus } from "@/lib/formatters";
import { z } from "zod";

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
    const validated = productSchema.extend({
      initialStock: z.number().int().min(0).default(0),
      purchasePrice: z.number().min(0).default(0),
      expiryDate: z.string().optional().nullable(),
    }).safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: validated.error.issues[0]?.message || "Xato ma'lumot" } },
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

    const relations = validated.data;
    if (relations.categoryId && !await prisma.category.findFirst({ where: { id: relations.categoryId, shopId }, select: { id: true } })) {
      return NextResponse.json({ success: false, error: "Kategoriya ushbu do‘konga tegishli emas" }, { status: 400 });
    }
    if (relations.manufacturerId && !await prisma.manufacturer.findFirst({ where: { id: relations.manufacturerId, shopId }, select: { id: true } })) {
      return NextResponse.json({ success: false, error: "Ishlab chiqaruvchi ushbu do‘konga tegishli emas" }, { status: 400 });
    }

    const { initialStock, purchasePrice, expiryDate } = validated.data;
    const expiresAt = expiryDate ? new Date(expiryDate) : new Date("2099-12-31T12:00:00.000Z");
    if (initialStock > 0 && !Number.isFinite(expiresAt.getTime())) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Yaroqlilik sanasi noto‘g‘ri" } }, { status: 400 });
    }
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
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
      if (initialStock > 0) {
        const batchNumber = `KIRIM-${Date.now()}-${created.id.slice(0, 6)}`;
        const batch = await tx.productBatch.create({
          data: { shopId, productId: created.id, batchNumber, initialQuantity: initialStock, currentQuantity: initialStock, purchasePrice, salePrice, expiryDate: expiresAt, status: getExpiryStatus(expiresAt).status },
        });
        await tx.inventoryTransaction.create({
          data: { shopId, productId: created.id, batchId: batch.id, type: "INFLOW", quantity: initialStock, unitPrice: purchasePrice, createdById: user.id, notes: `Yangi tovar bilan birga kirim: ${batchNumber}` },
        });
      }
      return created;
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
      message: initialStock > 0 ? "Mahsulot va ombor qoldig‘i saqlandi" : "Mahsulot saqlandi. Qoldiqni omborda kiritishingiz mumkin.",
      data: product,
    });
  } catch (error) {
    logger.error("Product POST error", { error: error });
    return NextResponse.json({ success: false, error: "Mahsulot qo‘shishda xatolik" }, { status: 500 });
  }
}
