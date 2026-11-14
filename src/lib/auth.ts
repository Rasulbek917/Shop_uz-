import { prisma } from "./prisma";
import { hasShopAccess, isMax } from "./plans";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { AuthUser, UserRole } from "@/types";
import type { NextResponse } from "next/server";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("JWT_SECRET sozlanmagan yoki 32 belgidan qisqa (.env faylini tekshiring)");
  }
  return secret || "dev_only_insecure_secret_do_not_use_in_production";
}
const COOKIE_NAME = "savdoza_auth_token";
const SESSION_SECONDS = 7 * 86400;

export function setAuthSession(response: NextResponse, user: AuthUser): NextResponse {
  response.cookies.set(COOKIE_NAME, signJwtToken(user), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: SESSION_SECONDS,
  });
  return response;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signJwtToken(payload: AuthUser): string {
  return jwt.sign(payload, getSecret(), { expiresIn: SESSION_SECONDS, algorithm: "HS256" });
}

export function verifyJwtToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return resolveUser(verifyJwtToken(token));
}

export function getAuthCookieName(): string {
  return COOKIE_NAME;
}

export async function resolveUser(claims: AuthUser | null): Promise<AuthUser | null> {
  if (!claims?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.id }, include: { shop: true } });
  if (!user || user.status !== "ACTIVE" || user.shop?.status === "DELETED" || (claims.tokenVersion || 0) !== user.tokenVersion) return null;
  const plan = user.shop?.planCode && ["PRO", "MAX"].includes(user.shop.planCode)
    ? await prisma.plan.findUnique({ where: { code: user.shop.planCode }, select: { price: true } })
    : null;
  const access = user.role === "SUPER_ADMIN" || (hasShopAccess(user.shop) && (user.role === "SHOP_ADMIN" || isMax(user.shop?.planCode)));
  return { id: user.id, username: user.username, fullName: user.fullName, role: user.role as UserRole,
    shopId: user.shopId, shopName: user.shop?.name, shopStatus: user.shop?.status as AuthUser["shopStatus"],
    subscriptionEndDate: user.shop?.subscriptionEndDate?.toISOString() || null,
    subscriptionDaysLeft: user.shop?.subscriptionEndDate ? Math.max(0, Math.ceil((user.shop.subscriptionEndDate.getTime() - Date.now()) / 86400000)) : null,
    planPrice: plan?.price ?? null,
    planCode: user.shop?.planCode, hasAccess: access, tokenVersion: user.tokenVersion };
}
