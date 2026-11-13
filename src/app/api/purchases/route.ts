import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { requestPurchase } from "@/lib/onboarding";
import { platformError } from "@/lib/platform-api";
import { z } from "zod";
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req, ["SHOP_ADMIN"]); if (auth.errorResponse) return auth.errorResponse;
  try {
    const body = z.object({ planCode: z.enum(["PRO", "MAX"]), paymentMethod: z.enum(["UZUM", "PAYME", "CLICK", "MANUAL"]).default("MANUAL"), reference: z.string().trim().min(5, "To‘lov raqami yoki izohni kiriting").max(500) }).parse(await req.json());
    if (!auth.user.shopId) return NextResponse.json({ success: false, error: "Do‘kon topilmadi" }, { status: 403 });
    return NextResponse.json({ success: true, data: await requestPurchase(prisma, auth.user.shopId, body.planCode, body.reference, body.paymentMethod) }, { status: 201 });
  } catch (e) { return platformError(e); }
}
