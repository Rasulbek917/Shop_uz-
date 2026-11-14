import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validWebhook } from "@/lib/payments/tezcheck-security";
import { openCredentials } from "@/lib/payments/pos-secrets";
import { findPosPayment, reconcilePosPayment } from "@/lib/payments/pos";
export async function POST(req: NextRequest, { params }: {
    params: {
        shopId: string;
    };
}) {
    try {
        const reader = req.body?.getReader();
        if (!reader)
            return new NextResponse(null, { status: 400 });
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
            const part = await reader.read();
            if (part.done)
                break;
            size += part.value.length;
            if (size > 65536) {
                await reader.cancel();
                return new NextResponse(null, { status: 413 });
            }
            chunks.push(part.value);
        }
        const raw = Buffer.concat(chunks).toString("utf8");
        const event = z.object({ type: z.string(), data: z.object({ external_reference: z.string().nullable(), bill_id: z.string(), environment: z.string() }) }).parse(JSON.parse(raw));
        const order = await findPosPayment(event.data.external_reference || "");
        if (!order || order.shopId !== params.shopId)
            return new NextResponse(null, { status: 503 });
        const credentials = openCredentials(order.shopId, order.credentials);
        if (!validWebhook(raw, req.headers, credentials.webhookSecret))
            return new NextResponse(null, { status: 401 });
        if (!order.billId)
            return new NextResponse(null, { status: 503 });
        if (order.billId !== event.data.bill_id)
            return new NextResponse(null, { status: 400 });
        if (event.type === "payment.succeeded" && event.data.environment === "live")
            await reconcilePosPayment(order);
        return NextResponse.json({ received: true });
    }
    catch {
        return NextResponse.json({ error: "To‘lovni tekshirish yakunlanmadi" }, { status: 503 });
    }
}
