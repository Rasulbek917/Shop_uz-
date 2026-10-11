import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
      "WAREHOUSEMAN",
      "CASHIER",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const body = await req.json();

    const {
      sku,
      name,
      barcodeValue,
      barcodeType,
      salePrice,
      initialStock = 1,
      unit = "dona",
      categoryName,
      brandName,
      description,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Mahsulot nomi kiritilmadi" } },
        { status: 400 }
      );
    }

    const price = typeof salePrice === "number" && salePrice >= 0 ? salePrice : 0;
    const stockQty = typeof initialStock === "number" && initialStock >= 0 ? initialStock : 0;
    const cleanCode = (barcodeValue || sku || "").trim();

    // 1. Check if product with this barcode or QR already exists in current shop
    let existingProduct = await prisma.product.findFirst({
      where: {
        shopId,
        OR: [
          { barcode: cleanCode },
          { qrCode: cleanCode },
        ],
      },
      include: {
        category: true,
        manufacturer: true,
        batches: {
          where: { currentQuantity: { gt: 0 } },
          orderBy: { expiryDate: "asc" },
        },
      },
    });

    if (existingProduct) {
      // Product already exists in local shop!
      const totalStock = existingProduct.batches.reduce((sum, b) => sum + b.currentQuantity, 0);
      return NextResponse.json({
        success: true,
        alreadyExisted: true,
        message: `"${existingProduct.name}" allaqachon do'koningizda mavjud`,
        product: {
          ...existingProduct,
          totalStock,
          nearestBatch: existingProduct.batches[0] || null,
        },
      });
    }

    // 2. Handle Category (find or create for this shop)
    let categoryId: string | null = null;
    if (categoryName && categoryName.trim()) {
      const cleanCat = categoryName.trim();
      let cat = await prisma.category.findUnique({
        where: { shopId_name: { shopId, name: cleanCat } },
      });
      if (!cat) {
        cat = await prisma.category.create({
          data: { shopId, name: cleanCat },
        });
      }
      categoryId = cat.id;
    }

    // 3. Handle Manufacturer / Brand (find or create for this shop)
    let manufacturerId: string | null = null;
    if (brandName && brandName.trim()) {
      const cleanBrand = brandName.trim();
      let man = await prisma.manufacturer.findUnique({
        where: { shopId_name: { shopId, name: cleanBrand } },
      });
      if (!man) {
        man = await prisma.manufacturer.create({
          data: { shopId, name: cleanBrand },
        });
      }
      manufacturerId = man.id;
    }

    // 4. Create local Product in transaction with initial Batch if stock > 0
    const result = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          shopId,
          name: name.trim(),
          barcode: barcodeType !== "QR" ? cleanCode : null,
          qrCode: barcodeType === "QR" ? cleanCode : cleanCode,
          salePrice: price,
          unit: unit || "dona",
          categoryId,
          manufacturerId,
          description: description || `Markazdan import qilingan (SKU: ${sku || cleanCode})`,
          status: "ACTIVE",
        },
      });

      let createdBatch = null;

      // Create initial batch if stock > 0
      if (stockQty > 0) {
        const oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 2); // 2 years expiry default

        createdBatch = await tx.productBatch.create({
          data: {
            shopId,
            productId: newProduct.id,
            batchNumber: `IMP-${Date.now().toString().slice(-6)}`,
            initialQuantity: stockQty,
            currentQuantity: stockQty,
            purchasePrice: price * 0.8, // default estimated purchase cost
            salePrice: price,
            expiryDate: oneYearLater,
            status: "NORMAL",
          },
        });

        // Record inflow transaction
        await tx.inventoryTransaction.create({
          data: {
            shopId,
            productId: newProduct.id,
            batchId: createdBatch.id,
            type: "INFLOW",
            quantity: stockQty,
            unitPrice: price,
            notes: `Markaziy kodlar bazasidan import qilindi (SKU: ${sku})`,
            createdById: user.id,
          },
        });
      }

      return { newProduct, createdBatch };
    });

    // 5. Audit Log
    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "MARKAZDAN_IMPORT_QILINDI",
      entity: "Product",
      entityId: result.newProduct.id,
      details: `Markazdan import: "${result.newProduct.name}" (SKU: ${sku}, Narx: ${price}, Qoldiq: ${stockQty})`,
    });

    const fullProduct = await prisma.product.findUnique({
      where: { id: result.newProduct.id },
      include: {
        category: true,
        manufacturer: true,
        batches: {
          where: { currentQuantity: { gt: 0 } },
          orderBy: { expiryDate: "asc" },
        },
      },
    });

    const totalStock = fullProduct?.batches.reduce((sum, b) => sum + b.currentQuantity, 0) || 0;
    const nearestBatch = fullProduct?.batches[0] || null;

    return NextResponse.json({
      success: true,
      message: `"${result.newProduct.name}" muvaffaqiyatli do'koningizga import qilindi`,
      product: {
        ...fullProduct,
        totalStock,
        nearestBatch,
      },
    });
  } catch (error: any) {
    logger.error("central-import route error", { error });
    return NextResponse.json(
      { success: false, error: { message: "Import qilishda xatolik: " + error.message } },
      { status: 500 }
    );
  }
}
