import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth";
import { createShopSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
import { getDaysRemaining } from "@/lib/formatters";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireApiAuth(req, ["SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;

    const shops = await prisma.shop.findMany({
      where: {
        status: { not: "DELETED" },
      },
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            sales: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { planName: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = shops.map((p) => {
      let daysRemaining = 0;
      if (p.status === "TRIAL" && p.trialEndDate) {
        daysRemaining = getDaysRemaining(p.trialEndDate);
      } else if (p.status === "ACTIVE" && p.subscriptionEndDate) {
        daysRemaining = getDaysRemaining(p.subscriptionEndDate);
      }

      return {
        ...p,
        daysRemaining,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    logger.error("Shops GET error", { error: error });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireApiAuth(req, ["SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const validated = createShopSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.errors[0]?.message || "Ma'lumotlar xato" },
        { status: 400 }
      );
    }

    const { name, phone, address, adminName, adminUsername, adminPassword, trialDays } = validated.data;

    // Check if username is taken
    const existingUser = await prisma.user.findUnique({
      where: { username: adminUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Ushbu admin logini allaqachon band. Boshqa login tanlang." },
        { status: 400 }
      );
    }

    const now = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(now.getDate() + (trialDays || 7));

    // Create Shop + Admin User inside a transaction
    const passwordHash = await hashPassword(adminPassword);

    const result = await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          name,
          phone,
          address,
          adminName,
          status: "TRIAL",
          trialStartDate: now,
          trialEndDate: trialEndDate,
          subscriptionType: "TRIAL",
        },
      });

      const adminUser = await tx.user.create({
        data: {
          shopId: shop.id,
          role: "SHOP_ADMIN",
          fullName: adminName,
          username: adminUsername,
          passwordHash,
          phone,
          status: "ACTIVE",
        },
      });

      // Default categories
      await tx.category.createMany({
        data: [
          { shopId: shop.id, name: "Oziq-ovqat", description: "Kundalik oziq-ovqat mahsulotlari" },
          { shopId: shop.id, name: "Ichimliklar", description: "Sovuq va issiq ichimliklar" },
          { shopId: shop.id, name: "Shirinliklar", description: "Shirinlik va pishiriqlar" },
          { shopId: shop.id, name: "Uy-ro‘zg‘r", description: "Uy uchun kerakli buyumlar" },
        ],
      });

      // Create initial notification for trial
      await tx.notification.create({
        data: {
          shopId: shop.id,
          title: "Xush kelibsiz!",
          message: `Sizga 7 kunlik bepul sinov muddati berildi. Tugash sanasi: ${trialEndDate.toLocaleDateString('uz-UZ')}`,
          type: "SYSTEM",
        },
      });

      return { shop, adminUser };
    });

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "DOKON_QOSHILDI",
      entity: "Shop",
      entityId: result.shop.id,
      details: `Yangi do‘kon yaratildi: "${name}", 7 kunlik trial berildi`,
    });

    return NextResponse.json({
      success: true,
      message: "Do‘kon muvaffaqiyatli qo‘shildi va 7 kunlik sinov muddati boshlandi",
      data: result.shop,
    });
  } catch (error: any) {
    logger.error("Create shop error", { error: error });
    return NextResponse.json(
      { success: false, error: "Do‘konni yaratishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
