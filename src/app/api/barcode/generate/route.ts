import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { getNextStoreSku, isValidEan13, calculateEan13CheckDigit } from "@/lib/sku";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SUPER_ADMIN",
      "SHOP_ADMIN",
      "WAREHOUSEMAN",
    ]);
    if (errorResponse) return errorResponse;

    const { user, shopId: tenantShopId } = context!;
    const body = await req.json();

    const {
      productId, // If updating existing product
      name,
      shopId: selectedShopId,
      sku: customSku,
      salePrice,
      brand,
      category,
      description,
      codeType = "CODE128", // CODE128 | QR | EAN13
      customBarcode,
    } = body;

    const targetShopId = selectedShopId || tenantShopId;
    if (!targetShopId) {
      return NextResponse.json(
        { success: false, error: { message: "Do'kon tanlanishi shart" } },
        { status: 400 }
      );
    }

    // 1. Validation
    if (!productId && (!name || !name.trim())) {
      return NextResponse.json(
        { success: false, error: { message: "Mahsulot nomi kiritilishi shart" } },
        { status: 400 }
      );
    }

    const price = typeof salePrice === "number" && salePrice >= 0 ? salePrice : 0;

    // 2. Determine Code Value
    let finalCode = (customBarcode || customSku || "").trim();

    if (codeType === "EAN13") {
      if (finalCode) {
        const clean = finalCode.replace(/\D/g, "");
        if (clean.length === 13 && isValidEan13(clean)) {
          finalCode = clean;
        } else if (clean.length === 12) {
          finalCode = calculateEan13CheckDigit(clean);
        } else {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: "Noto'g'ri EAN-13 formati. 13 ta raqam va to'g'ri nazorat soni (checksum) talab qilinadi.",
              },
            },
            { status: 400 }
          );
        }
      } else {
        // Auto-generate store internal EAN-13 prefix 200
        const autoSku = await getNextStoreSku(targetShopId);
        const numericOnly = autoSku.replace(/\D/g, "").padStart(9, "0");
        finalCode = calculateEan13CheckDigit(`200${numericOnly}`);
      }
    } else if (!finalCode) {
      finalCode = await getNextStoreSku(targetShopId);
    }

    // 3. Check for duplicates in the store
    const duplicateWhere: any = {
      shopId: targetShopId,
      OR: [
        { barcode: finalCode },
        { qrCode: finalCode },
      ],
    };
    if (productId) {
      duplicateWhere.id = { not: productId };
    }

    const existingConflict = await prisma.product.findFirst({
      where: duplicateWhere,
    });

    if (existingConflict) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `"${finalCode}" kodi allaqachon boshqa mahsulotga ("${existingConflict.name}") biriktirilgan.`,
          },
        },
        { status: 409 }
      );
    }

    // 4. Handle Category
    let categoryId: string | null = null;
    if (category && category.trim()) {
      const catName = category.trim();
      let cat = await prisma.category.findUnique({
        where: { shopId_name: { shopId: targetShopId, name: catName } },
      });
      if (!cat) {
        cat = await prisma.category.create({
          data: { shopId: targetShopId, name: catName },
        });
      }
      categoryId = cat.id;
    }

    // 5. Handle Brand / Manufacturer
    let manufacturerId: string | null = null;
    if (brand && brand.trim()) {
      const brandName = brand.trim();
      let man = await prisma.manufacturer.findUnique({
        where: { shopId_name: { shopId: targetShopId, name: brandName } },
      });
      if (!man) {
        man = await prisma.manufacturer.create({
          data: { shopId: targetShopId, name: brandName },
        });
      }
      manufacturerId = man.id;
    }

    // 6. Reuse existing product or create new
    let product;

    if (productId) {
      // Reuse existing product record
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (price !== undefined) updateData.salePrice = price;
      if (description !== undefined) updateData.description = description.trim();
      if (categoryId) updateData.categoryId = categoryId;
      if (manufacturerId) updateData.manufacturerId = manufacturerId;

      if (codeType === "QR") {
        updateData.qrCode = finalCode;
      } else {
        updateData.barcode = finalCode;
      }

      product = await prisma.product.update({
        where: { id: productId },
        data: updateData,
        include: {
          shop: { select: { name: true } },
          category: true,
          manufacturer: true,
          batches: { where: { currentQuantity: { gt: 0 } } },
        },
      });

      await logAudit({
        shopId: targetShopId,
        userId: user.id,
        userName: user.fullName,
        action: "SHTRIX_KOD_YANGILANDI",
        entity: "Product",
        entityId: product.id,
        details: `Kod yangilandi: ${product.name} (${codeType}: ${finalCode})`,
      });
    } else {
      // Create new product
      product = await prisma.product.create({
        data: {
          shopId: targetShopId,
          name: name.trim(),
          salePrice: price,
          barcode: codeType !== "QR" ? finalCode : null,
          qrCode: codeType === "QR" ? finalCode : null,
          categoryId,
          manufacturerId,
          description: description?.trim() || null,
          status: "ACTIVE",
          unit: "dona",
          minStock: 5,
        },
        include: {
          shop: { select: { name: true } },
          category: true,
          manufacturer: true,
          batches: true,
        },
      });

      await logAudit({
        shopId: targetShopId,
        userId: user.id,
        userName: user.fullName,
        action: "MAHSULOT_VA_KOD_YARATILDI",
        entity: "Product",
        entityId: product.id,
        details: `Yangi mahsulot va kod yaratildi: ${product.name} (${codeType}: ${finalCode})`,
      });
    }

    return NextResponse.json({
      success: true,
      message: productId ? "Kod muvaffaqiyatli yangilandi" : "Yangi mahsulot va unikal kod yaratildi",
      product: {
        ...product,
        sku: finalCode,
        barcodeType: codeType,
        barcodeValue: finalCode,
        shopName: product.shop?.name || "Shop Market",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: "Kod yaratishda xatolik: " + error.message } },
      { status: 500 }
    );
  }
}
