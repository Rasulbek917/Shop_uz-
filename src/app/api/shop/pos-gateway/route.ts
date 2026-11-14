import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { posCredentialsSchema, sealCredentials } from "@/lib/payments/pos-secrets";
import { sendTezcheck } from "@/lib/payments/tezcheck";
import { paymentMethodSchema } from "@/lib/payments/tezcheck-security";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
    const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN", "SUPER_ADMIN"]);
    if (errorResponse)
        return errorResponse;
    const gateway = await prisma.posGateway.findUnique({ where: { shopId: context!.shopId }, select: { cashDeskCode: true } });
    const origin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    return NextResponse.json({ success: true, data: { configured: !!gateway, cashDeskCode: gateway?.cashDeskCode || "", webhookUrl: origin ? new URL(`/api/webhooks/tezcheck/pos/${context!.shopId}`, origin).toString() : "" } });
}
export async function PUT(req: NextRequest) {
    const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN", "SUPER_ADMIN"]);
    if (errorResponse)
        return errorResponse;
    try {
        const credentials = posCredentialsSchema.parse(await req.json());
        const methods = z.array(paymentMethodSchema).parse(await sendTezcheck("/payment-methods", undefined, undefined, credentials));
        if (!methods.length)
            return NextResponse.json({ success: false, error: "Bu kassada to‘lov usullari yoqilmagan" }, { status: 409 });
        const encrypted = sealCredentials(context!.shopId, credentials);
        await prisma.posGateway.upsert({ where: { shopId: context!.shopId }, create: { shopId: context!.shopId, credentials: encrypted, cashDeskCode: credentials.cashDeskCode }, update: { credentials: encrypted, cashDeskCode: credentials.cashDeskCode } });
        return NextResponse.json({ success: true, data: { configured: true } });
    }
    catch (error) {
        return NextResponse.json({ success: false, error: error instanceof z.ZodError ? "API tokeni, kassa kodi va webhook kalitini tekshiring" : (error as Error).message }, { status: 400 });
    }
}
