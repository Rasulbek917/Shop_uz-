import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { reviewRegistration, reviewPurchase } from "@/lib/onboarding";
import { platformError } from "@/lib/platform-api";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req, ["SUPER_ADMIN"]); if (auth.errorResponse) return auth.errorResponse;
  try {
    const registrations = await prisma.shop.findMany({ where: { status: "PENDING" }, include: { users: { select: { fullName: true, username: true, email: true, phone: true } } }, orderBy: { createdAt: "asc" } });
    const purchases = await prisma.purchaseRequest.findMany({ where: { status: "PENDING" }, include: { shop: { select: { name: true, adminName: true, phone: true } } }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ success: true, data: { registrations, purchases } });
  } catch (e) { return platformError(e); }
}
export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth(req, ["SUPER_ADMIN"]); if (auth.errorResponse) return auth.errorResponse;
  try {
    const body = z.object({ kind: z.enum(["registration", "purchase"]), id: z.string().uuid(), approve: z.boolean(), note: z.string().trim().max(500).default("") }).parse(await req.json());
    if (body.kind === "registration") await reviewRegistration(prisma, body.id, body.approve, auth.user.id, body.note);
    else await reviewPurchase(prisma, body.id, body.approve, auth.user.id, body.note);
    return NextResponse.json({ success: true });
  } catch (e) { return platformError(e); }
}
