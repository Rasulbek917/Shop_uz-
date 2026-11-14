import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signJwtToken, getAuthCookieName, resolveUser } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { getDaysRemaining } from "@/lib/formatters";
import { logAudit } from "@/lib/audit";
import { takeAuthAttempt, resetAuthAttempts } from "@/lib/rateLimit";
import { AuthUser, ShopStatus } from "@/types";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validated.error.issues[0]?.message || "Ma'lumotlar noto‘g‘ri kiritildi",
          },
        },
        { status: 400 }
      );
    }

    const { username, password } = validated.data;
    const ipAddress = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateLimitKey = `login:${username.toLowerCase()}`;

    // 1. Check rate limit
    const accountRate = await takeAuthAttempt(rateLimitKey);
    const ipRate = await takeAuthAttempt(`login-ip:${ipAddress.split(",")[0].trim()}`, 100, 10);
    const rateCheck = accountRate.allowed ? ipRate : accountRate;
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOO_MANY_REQUESTS",
            message: "Ko‘p kirish urinishi. Birozdan keyin qayta urinib ko‘ring.",
          },
        },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
      );
    }

    // 2. Find user
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        shop: true,
      },
    });

    if (!user) {
      const failResult = accountRate;
      await logAudit({
        action: "TIZIMGA_KIRISH_XATOSI",
        entity: "User",
        ipAddress,
        details: `Noma'lum foydalanuvchi orqali kirishga urinish: "${username}"`,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Login yoki parol noto‘g‘ri!",
          },
        },
        { status: 401 }
      );
    }

    // 3. Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      const failResult = accountRate;
      await logAudit({
        shopId: user.shopId,
        userId: user.id,
        userName: user.fullName,
        action: "NOTOGRI_PAROL",
        entity: "User",
        entityId: user.id,
        ipAddress,
        details: `Foydalanuvchi "${username}" uchun noto‘g‘ri parol kiritildi. Qolgan urinishlar: ${failResult.remainingAttempts}`,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Login yoki parol noto‘g‘ri!",
          },
        },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ACCOUNT_INACTIVE",
            message: "Ushbu foydalanuvchi hisobi faol emas yoki bloklangan.",
          },
        },
        { status: 403 }
      );
    }

    // Login succeeded: reset rate limit attempts
    await resetAuthAttempts(rateLimitKey);

    let trialDaysLeft: number | null = null;
    let subscriptionDaysLeft: number | null = null;

    // 4. If user belongs to a shop, check subscription and status
    if (user.shop && user.role !== "SUPER_ADMIN") {
      const shop = user.shop;

      if (shop.status === "DELETED") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "SHOP_DELETED",
              message: "Ushbu do‘kon tizimdan o‘chirilgan.",
            },
          },
          { status: 403 }
        );
      }

      const now = new Date();
      let shouldBlock = false;

      // Check trial
      if (shop.status === "TRIAL" && shop.trialEndDate) {
        trialDaysLeft = getDaysRemaining(shop.trialEndDate);
        if (trialDaysLeft <= 0) {
          shouldBlock = true;
        }
      }

      // Check subscription
      if (shop.status === "ACTIVE" && shop.subscriptionEndDate) {
        subscriptionDaysLeft = getDaysRemaining(shop.subscriptionEndDate);
        if (subscriptionDaysLeft <= 0) {
          shouldBlock = true;
        }
      }

      if (shouldBlock && shop.status !== "BLOCKED") {
        await prisma.shop.update({
          where: { id: shop.id },
          data: { status: "EXPIRED" },
        });
        shop.status = "EXPIRED";
      }

    }

    const authUser: AuthUser = {
      tokenVersion: user.tokenVersion,
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as any,
      shopId: user.shopId,
      shopName: user.shop?.name || null,
      shopStatus: (user.shop?.status as ShopStatus) || null,
      trialDaysLeft,
      subscriptionDaysLeft,
    };

    const token = signJwtToken(authUser);

    // Audit log
    await logAudit({
      shopId: user.shopId,
      userId: user.id,
      userName: user.fullName,
      action: "TIZIMGA_KIRISH",
      entity: "User",
      entityId: user.id,
      ipAddress,
      details: `${user.fullName} (${user.role}) tizimga muvaffaqiyatli kirdi`,
    });

    const response = NextResponse.json({
      success: true,
      message: "Tizimga muvaffaqiyatli kirdingiz",
      user: await resolveUser(authUser),
    });

    response.cookies.set({
      name: getAuthCookieName(),
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    logger.error("Login error", { error: error });
    const schemaMissing = ["P2021", "P2022"].includes(error?.code);
    const hint = schemaMissing
      ? "Baza yangilanishi bajarilmagan. Administrator saytni qayta ishga tushirishi kerak."
      : "Ma’lumotlar bazasiga ulanib bo‘lmadi. Qayta urinib ko‘ring.";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: hint,
        },
      },
      { status: 500 }
    );
  }
}
