import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/types";
import { signJwtToken, getAuthCookieName, hashPassword } from "@/lib/auth";
import { registrationSchema, registerShop } from "@/lib/onboarding";
import { platformError } from "@/lib/platform-api";
import { checkLoginRateLimit, recordFailedLoginAttempt } from "@/lib/rateLimit";
export async function POST(req: NextRequest) {
  const key = "register:" + (req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local");
  if (!checkLoginRateLimit(key, 5, 15).allowed) return NextResponse.json({ success: false, error: "Juda ko‘p urinish. 15 daqiqadan keyin urinib ko‘ring" }, { status: 429 });
  recordFailedLoginAttempt(key, 5, 15);
  try {
    const input = registrationSchema.parse(await req.json());
    const data = await registerShop(prisma, input, await hashPassword(input.password));
    const response = NextResponse.json({ success: true, data: { id: data.id, status: data.status, planCode: data.planCode }, nextUrl: `/checkout?plan=${data.planCode}` }, { status: 201 });
    response.cookies.set(getAuthCookieName(), signJwtToken({ ...data.user, role: data.user.role as AuthUser["role"] }), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 86400,
    });
    return response;
  } catch (error) { return platformError(error); }
}
