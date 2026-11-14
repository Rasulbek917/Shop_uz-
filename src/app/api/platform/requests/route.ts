import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { reviewRegistration, reviewPurchase, grantRegistrationAccess } from "@/lib/onboarding";
import { platformError } from "@/lib/platform-api";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req, ["SUPER_ADMIN"]); if (auth.errorResponse) return auth.errorResponse;
  try {
    const [registrations, purchases, checkouts] = await Promise.all([
      prisma.shop.findMany({
        where: {
          status: { not: "DELETED" },
          OR: [
            { status: { in: ["PENDING", "AWAITING_PAYMENT"] } },
            { subscriptions: { some: { paymentMethod: "ADMIN_GRANT" } } },
          ],
        },
        include: { users: { where: { role: "SHOP_ADMIN" }, select: { fullName: true, username: true, email: true, phone: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchaseRequest.findMany({ where: { status: "PENDING" }, include: { shop: { select: { name: true, adminName: true, phone: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.checkoutOrder.findMany({
        where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 100,
        select: { id: true, status: true, amount: true, planCode: true, paidAt: true, shop: { select: { name: true, adminName: true, phone: true } } },
      }),
    ]);
    return NextResponse.json({ success: true, data: { registrations, purchases, checkouts } });
  } catch (e) { return platformError(e); }
}
export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth(req, ["SUPER_ADMIN"]); if (auth.errorResponse) return auth.errorResponse;
  try {
    const body = z.union([
      z.object({ kind: z.enum(["registration", "purchase"]), id: z.string().uuid(), approve: z.boolean(), note: z.string().trim().max(500).default("") }),
      z.object({ kind: z.literal("access"), id: z.string().uuid(), planCode: z.enum(["PRO", "MAX"]), durationDays: z.number().int().positive(), note: z.string().trim().max(500).default("") }),
    ]).parse(await req.json());
    if (body.kind === "access") {
      const data = await grantRegistrationAccess(prisma, body.id, body.planCode, body.durationDays, auth.user.id, body.note);
      return NextResponse.json({ success: true, data });
    }
    if (body.kind === "registration") await reviewRegistration(prisma, body.id, body.approve, auth.user.id, body.note);
    else await reviewPurchase(prisma, body.id, body.approve, auth.user.id, body.note);
    return NextResponse.json({ success: true });
  } catch (e) { return platformError(e); }
}
