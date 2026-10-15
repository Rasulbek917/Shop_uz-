import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, signJwtToken, getAuthCookieName } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { AuthUser, ShopStatus } from "@/types";

export const dynamic = "force-dynamic";

// Kiritilgan matnni tozalash (bosh/oxirgi bo'shliqlar)
function clean(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  return value.trim();
}

// GET: joriy foydalanuvchining profil ma'lumotlari
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Avval tizimga kiring" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { shop: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Foydalanuvchi topilmadi" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        shopId: user.shopId,
        shopName: user.shop?.name || null,
      },
    });
  } catch (error) {
    logger.error("GET /api/profile xatolik", { error, route: "/api/profile" });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "Ma'lumotni yuklashda xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}

// PATCH: ism-familiya, telefon va loginni yangilash
export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Avval tizimga kiring" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validated = updateProfileSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validated.error.errors[0]?.message || "Ma'lumotlar noto‘g‘ri kiritildi",
          },
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { shop: true },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Foydalanuvchi topilmadi" } },
        { status: 404 }
      );
    }

    const newFullName = clean(validated.data.fullName);
    const newPhone = clean(validated.data.phone);
    const newUsername = clean(validated.data.username);

    // Login bandligini tekshirish (o'zidan boshqa foydalanuvchi egallamagan bo'lishi kerak)
    if (newUsername && newUsername !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username: newUsername } });
      if (existing && existing.id !== user.id) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "USERNAME_TAKEN",
              message: "Bu login allaqachon ishlatilmoqda. Boshqa login tanlang.",
            },
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: newFullName || user.fullName,
        phone: validated.data.phone === undefined ? user.phone : newPhone ?? null,
        username: newUsername || user.username,
      },
    });

    // Yangilangan ma'lumotlar bilan JWT tokenni qayta berish (UI darhol yangilanishi uchun)
    const authUser: AuthUser = {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role as AuthUser["role"],
      shopId: updated.shopId,
      shopName: user.shop?.name || null,
      shopStatus: (user.shop?.status as ShopStatus) || null,
      trialDaysLeft: currentUser.trialDaysLeft ?? null,
      subscriptionDaysLeft: currentUser.subscriptionDaysLeft ?? null,
    };

    const token = signJwtToken(authUser);
    const response = NextResponse.json({
      success: true,
      message: "Profil ma'lumotlari muvaffaqiyatli saqlandi",
      data: {
        id: updated.id,
        username: updated.username,
        fullName: updated.fullName,
        phone: updated.phone,
        role: updated.role,
        shopId: updated.shopId,
        shopName: user.shop?.name || null,
      },
    });

    response.cookies.set({
      name: getAuthCookieName(),
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    });

    await logAudit({
      shopId: updated.shopId,
      userId: updated.id,
      userName: updated.fullName,
      action: "PROFIL_YANGILANDI",
      entity: "User",
      entityId: updated.id,
      details: `${updated.fullName} (${updated.role}) o‘z profil ma'lumotlarini yangiladi`,
    });

    return response;
  } catch (error) {
    logger.error("PATCH /api/profile xatolik", { error, route: "/api/profile" });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "Profilni saqlashda xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}
