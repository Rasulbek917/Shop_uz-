import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, verifyJwtToken, getAuthCookieName } from "./auth";
import { prisma } from "./prisma";
import { AuthUser, UserRole } from "@/types";

export interface TenantContext {
  user: AuthUser;
  shopId: string;
}

export async function authenticateApi(req: NextRequest): Promise<AuthUser | null> {
  // 1. Try reading from cookie
  const cookieToken = req.cookies.get(getAuthCookieName())?.value;
  if (cookieToken) {
    const user = verifyJwtToken(cookieToken);
    if (user) return user;
  }

  // 2. Try Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const user = verifyJwtToken(token);
    if (user) return user;
  }

  return null;
}

export async function requireApiAuth(
  req: NextRequest, 
  allowedRoles?: UserRole[]
): Promise<{ user: AuthUser; errorResponse?: NextResponse }> {
  const user = await authenticateApi(req);

  if (!user) {
    return {
      user: null as any,
      errorResponse: NextResponse.json(
        { success: false, error: "Tizimga kirish talab qilinadi. Sessiya eskirgan." },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      user,
      errorResponse: NextResponse.json(
        { success: false, error: "Ushbu amalni bajarish uchun sizda yetarli huquq yo'q." },
        { status: 403 }
      ),
    };
  }

  return { user };
}

export async function requireTenantContext(
  req: NextRequest,
  allowedRoles?: UserRole[]
): Promise<{ context?: TenantContext; errorResponse?: NextResponse }> {
  const { user, errorResponse } = await requireApiAuth(req, allowedRoles);
  if (errorResponse) return { errorResponse };

  // Super admin can operate with query param shopId or global
  if (user.role === "SUPER_ADMIN") {
    const requestedShopId = req.nextUrl.searchParams.get("shopId") || user.shopId || "";
    return { context: { user, shopId: requestedShopId } };
  }

  if (!user.shopId) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: "Foydalanuvchiga do‘kon biriktirilmagan." },
        { status: 403 }
      ),
    };
  }

  // Check shop subscription and status
  const shop = await prisma.shop.findUnique({
    where: { id: user.shopId },
  });

  if (!shop || shop.status === "DELETED") {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: "Do‘kon topilmadi yoki o'chirilgan." },
        { status: 404 }
      ),
    };
  }

  // Automatic subscription / trial expiration check
  const now = new Date();
  let isExpired = false;

  if (shop.status === "TRIAL" && shop.trialEndDate) {
    if (new Date(shop.trialEndDate) < now) {
      isExpired = true;
    }
  } else if (shop.status === "ACTIVE" && shop.subscriptionEndDate) {
    if (new Date(shop.subscriptionEndDate) < now) {
      isExpired = true;
    }
  }

  if (isExpired && shop.status !== "BLOCKED") {
    // Automatically transition to BLOCKED in database
    await prisma.shop.update({
      where: { id: shop.id },
      data: { status: "BLOCKED" },
    });
    shop.status = "BLOCKED";
  }

  if (shop.status === "BLOCKED") {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          isBlocked: true,
          error: "Obunangiz tugagan. Tizimdan foydalanishni davom ettirish uchun obunani yangilang.",
        },
        { status: 403 }
      ),
    };
  }

  return { context: { user, shopId: shop.id } };
}
