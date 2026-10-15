import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth";
import { updateShopSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { getDaysRemaining } from "@/lib/formatters";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, errorResponse } = await requireApiAuth(req, ["SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;

    const shop = await prisma.shop.findUnique({
      where: { id: params.id },
      include: {
        users: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
            phone: true,
            status: true,
            createdAt: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            products: true,
            sales: true,
            suppliers: true,
          },
        },
      },
    });

    if (!shop) {
      return NextResponse.json({ success: false, error: "Do‘kon topilmadi" }, { status: 404 });
    }

    let daysRemaining = 0;
    if (shop.status === "TRIAL" && shop.trialEndDate) {
      daysRemaining = getDaysRemaining(shop.trialEndDate);
    } else if (shop.status === "ACTIVE" && shop.subscriptionEndDate) {
      daysRemaining = getDaysRemaining(shop.subscriptionEndDate);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...shop,
        daysRemaining,
      },
    });
  } catch (error) {
    logger.error("GET /api\shops\:id\route.ts xatolik", { error: error, route: "/api\shops\:id\route.ts" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, errorResponse } = await requireApiAuth(req, ["SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const validated = updateShopSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validated.error.errors[0]?.message || "Xato ma'lumot",
          },
        },
        { status: 400 }
      );
    }

    const currentShop = await prisma.shop.findUnique({
      where: { id: params.id },
    });

    if (!currentShop) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Do‘kon topilmadi" } },
        { status: 404 }
      );
    }

    // Admin logini va paroli User jadvida saqlanadi, shuning uchun ularni
    // Shop ustunlaridan ajratib olamiz.
    const { adminUsername, adminPassword, ...shopData } = validated.data;
    const newUsername = adminUsername?.trim();

    const adminUser = await prisma.user.findFirst({
      where: { shopId: params.id, role: "SHOP_ADMIN" },
    });

    const usernameChanged =
      !!newUsername && !!adminUser && adminUser.username !== newUsername;
    const passwordChanged = !!adminPassword;

    // Yangi login boshqa foydalanuvchi tomonidan band qilinmaganini tekshiramiz
    if (newUsername && adminUser && adminUser.username !== newUsername) {
      const taken = await prisma.user.findUnique({ where: { username: newUsername } });
      if (taken && taken.id !== adminUser.id) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "USERNAME_TAKEN",
              message: "Ushbu admin logini allaqachon band. Boshqa login tanlang.",
            },
          },
          { status: 400 }
        );
      }
    }

    const hasShopFields = Object.keys(shopData).length > 0;

    const result = await prisma.$transaction(async (tx) => {
      let updatedShop = currentShop;
      if (hasShopFields) {
        updatedShop = await tx.shop.update({
          where: { id: params.id },
          data: shopData,
        });
      }

      if (adminUser) {
        const userData: { username?: string; fullName?: string; passwordHash?: string } = {};
        if (newUsername && adminUser.username !== newUsername) userData.username = newUsername;
        if (shopData.adminName) userData.fullName = shopData.adminName;
        if (adminPassword) userData.passwordHash = await hashPassword(adminPassword);
        if (Object.keys(userData).length > 0) {
          await tx.user.update({ where: { id: adminUser.id }, data: userData });
        }
      }

      return updatedShop;
    });

    // Holat o'zgarganini audit qilish
    if (validated.data.status && validated.data.status !== currentShop.status) {
      const action =
        validated.data.status === "BLOCKED"
          ? "DOKON_BLOKLANDI"
          : validated.data.status === "ACTIVE"
          ? "DOKON_OCHILDI"
          : "DOKON_HOLATI_OZGARDI";

      await logAudit({
        shopId: params.id,
        userId: user.id,
        userName: user.fullName,
        action,
        entity: "Shop",
        entityId: params.id,
        details: `Do‘kon holati o'zgartirildi: ${currentShop.status} -> ${validated.data.status}`,
      });
    }

    // Tahrirlashni audit qilish (parol qiymati hech qachon loglanmaydi)
    const changedFields: string[] = [];
    if (validated.data.name && validated.data.name !== currentShop.name) changedFields.push("nomi");
    if (validated.data.phone && validated.data.phone !== currentShop.phone) changedFields.push("telefoni");
    if (validated.data.address && validated.data.address !== currentShop.address) changedFields.push("manzili");
    if (validated.data.adminName && validated.data.adminName !== currentShop.adminName) changedFields.push("admin ismi");
    if (usernameChanged) changedFields.push("admin logini");
    if (passwordChanged) changedFields.push("admin paroli");

    if (changedFields.length > 0) {
      await logAudit({
        shopId: params.id,
        userId: user.id,
        userName: user.fullName,
        action: "DOKON_TAHRIRLANDI",
        entity: "Shop",
        entityId: params.id,
        details: `"${currentShop.name}" do‘koni tahrirlandi. O'zgartirilgan: ${changedFields.join(", ")}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Do‘kon ma'lumotlari muvaffaqiyatli yangilandi",
      data: result,
    });
  } catch (error) {
    logger.error("PATCH /api/shops/[id] xatolik", { error: error, route: "/api/shops/[id]" });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "Xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, errorResponse } = await requireApiAuth(req, ["SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;

    const existing = await prisma.shop.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Do‘kon topilmadi" }, { status: 404 });
    }

    // Do'kon soft-delete qilinadi, ammo unga tegishli foydalanuvchilarning
    // loginlari band bo'lib qolmasligi uchun ularni bo'shatamiz (nofaol qilib,
    // login nomini noyob ko'rinishga o'zgartiramiz). Aks holda o'chirilgan
    // do'kon admini logini bilan yangi do'kon qo'shib bo'lmaydi.
    const shopUsers = await prisma.user.findMany({ where: { shopId: params.id } });

    const shop = await prisma.$transaction(async (tx) => {
      const updated = await tx.shop.update({
        where: { id: params.id },
        data: { status: "DELETED" },
      });

      for (const u of shopUsers) {
        await tx.user.update({
          where: { id: u.id },
          data: {
            status: "INACTIVE",
            username: `${u.username}__deleted_${u.id.slice(0, 8)}`,
          },
        });
      }

      return updated;
    });

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "DOKON_OCHIRILDI",
      entity: "Shop",
      entityId: params.id,
      details: `Do‘kon soft-delete qilindi: ${shop.name}`,
    });

    return NextResponse.json({
      success: true,
      message: "Do‘kon muvaffaqiyatli o‘chirildi",
    });
  } catch (error) {
    logger.error("DELETE /api\shops\:id\route.ts xatolik", { error: error, route: "/api\shops\:id\route.ts" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}
