import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { getDaysRemaining } from "@/lib/formatters";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const EXPIRY_WARNING_DAYS = parseInt(process.env.EXPIRY_WARNING_DAYS || "90", 10);

async function generateExpiryNotifications(shopId: string) {
  const now = new Date();
  const warningCutoff = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);

  const batches = await prisma.productBatch.findMany({
    where: {
      shopId,
      currentQuantity: { gt: 0 },
      expiryDate: { lte: warningCutoff },
    },
    include: { product: { select: { name: true, unit: true } } },
    orderBy: { expiryDate: "asc" },
    take: 50,
  });

  for (const batch of batches) {
    const daysLeft = getDaysRemaining(batch.expiryDate);
    const isExpired = daysLeft <= 0;
    const type = isExpired ? "EXPIRED" : "EXPIRY_APPROACHING";
    const refKey = `BATCH_${batch.id}`;

    const title = isExpired ? "Muddati o'tgan mahsulot!" : "Yaroqlilik muddati yaqinlashmoqda!";
    const message = isExpired
      ? `"${batch.product.name}" (Partiya #${batch.batchNumber}) muddati tugagan. Sotuvdan olib tashlang.`
      : `"${batch.product.name}" (Partiya #${batch.batchNumber}) muddati ${daysLeft} kundan keyin tugaydi. Qoldiq: ${batch.currentQuantity} ${batch.product.unit}.`;

    await prisma.notification.upsert({
      where: {
        shopId_type_referenceKey: { shopId, type, referenceKey: refKey },
      },
      update: { title, message },
      create: { shopId, title, message, type, referenceKey: refKey },
    });

    if (isExpired && batch.status !== "EXPIRED") {
      await prisma.productBatch.update({
        where: { id: batch.id },
        data: { status: "EXPIRED" },
      });
    } else if (!isExpired && daysLeft <= EXPIRY_WARNING_DAYS && batch.status === "NORMAL") {
      await prisma.productBatch.update({
        where: { id: batch.id },
        data: { status: "APPROACHING" },
      });
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;

    await generateExpiryNotifications(shopId);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (shop) {
      const now = new Date();
      if (shop.status === "TRIAL" && shop.trialEndDate) {
        const days = getDaysRemaining(shop.trialEndDate);
        if (days <= 7 && days > 0) {
          const refKey = `TRIAL_${shop.id}_${days}`;
          await prisma.notification.upsert({
            where: {
              shopId_type_referenceKey: { shopId, type: "TRIAL_EXPIRING", referenceKey: refKey },
            },
            update: {},
            create: {
              shopId,
              title: "Sinov muddati ogohlantirishi",
              message: days === 1
                ? "Sinov muddatingiz ertaga tugaydi. Obunani faollashtiring."
                : `Sinov muddatingiz tugashiga ${days} kun qoldi.`,
              type: "TRIAL_EXPIRING",
              referenceKey: refKey,
            },
          });
        }
      }

      if (shop.status === "ACTIVE" && shop.subscriptionEndDate) {
        const days = getDaysRemaining(shop.subscriptionEndDate);
        if (days <= 7 && days > 0) {
          const refKey = `SUB_${shop.id}_${days}`;
          await prisma.notification.upsert({
            where: {
              shopId_type_referenceKey: { shopId, type: "SUB_EXPIRING", referenceKey: refKey },
            },
            update: {},
            create: {
              shopId,
              title: "Obuna muddati ogohlantirishi",
              message: days === 1
                ? "Obunangiz ertaga tugaydi."
                : `Obunangiz tugashiga ${days} kun qoldi.`,
              type: "SUB_EXPIRING",
              referenceKey: refKey,
            },
          });
        }
      }
    }

    const notifications = await prisma.notification.findMany({
      where: { shopId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { shopId, isRead: false, isDeleted: false },
    });

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    logger.error("Notifications GET error", { error: error });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;
    const body = await req.json().catch(() => ({}));

    if (body.all) {
      await prisma.notification.updateMany({
        where: { shopId, isRead: false },
        data: { isRead: true },
      });
    } else if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, shopId },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true, message: "O‘qildi deb belgilandi" });
  } catch (error) {
    logger.error("PATCH /api\notifications\route.ts xatolik", { error: error, route: "/api\notifications\route.ts" });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "Xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;
    const url = new URL(req.url);
    const idFromParam = url.searchParams.get("id");
    const allFromParam = url.searchParams.get("all") === "true";

    let id = idFromParam;
    let all = allFromParam;

    if (!id && !all) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
      all = body.all;
    }

    if (all) {
      const result = await prisma.notification.updateMany({
        where: { shopId, isDeleted: false },
        data: { isDeleted: true, isRead: true },
      });
      return NextResponse.json({
        success: true,
        message: "Barcha bildirishnomalar o’chirildi",
        count: result.count,
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_ID", message: "O’chirish uchun bildirishnoma ID ko’rsatilmadi" } },
        { status: 400 }
      );
    }

    const result = await prisma.notification.updateMany({
      where: { id, shopId, isDeleted: false },
      data: { isDeleted: true, isRead: true },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Bildirishnoma topilmadi yoki allaqachon o’chirilgan" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Bildirishnoma muvaffaqiyatli o’chirildi",
    });
  } catch (error) {
    logger.error("Notification DELETE error", { error: error });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "Bildirishnomani o’chirishda xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}
