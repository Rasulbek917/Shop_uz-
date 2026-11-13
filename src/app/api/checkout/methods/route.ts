import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/tenant";
import { paymentConfigured, paymentMethods } from "@/lib/payments/tezcheck";
import { platformError } from "@/lib/platform-api";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiAuth(req, ["SHOP_ADMIN"]);
    if (auth.errorResponse) return auth.errorResponse;
    if (!paymentConfigured()) return NextResponse.json({ success: true, data: { configured: false, methods: [] } });
    return NextResponse.json({ success: true, data: { configured: true, methods: await paymentMethods() } });
  } catch (error) { return platformError(error); }
}
