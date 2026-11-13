import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/tenant";
import { createCheckout } from "@/lib/payments/tezcheck";
import { platformError } from "@/lib/platform-api";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiAuth(req, ["SHOP_ADMIN"]);
    if (auth.errorResponse) return auth.errorResponse;
    if (!auth.user.shopId) return NextResponse.json({ success: false, error: "Do‘kon topilmadi" }, { status: 403 });
    const body = z.object({ planCode: z.enum(["PRO", "MAX"]), providerCode: z.string().min(1).max(80), username: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9_.-]+$/, "Loginni lotin harflari va raqamlarda kiriting").optional() }).parse(await req.json());
    if (body.username && body.username.toLowerCase() !== auth.user.username.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Hisobingizga kirgan loginni kiriting" }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: await createCheckout(auth.user.shopId, body.planCode, body.providerCode) });
  } catch (error) { return platformError(error); }
}
