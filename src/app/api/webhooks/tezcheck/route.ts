import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validWebhook } from "@/lib/payments/tezcheck-security";
import { reconcileCheckout } from "@/lib/payments/tezcheck";
import { prisma } from "@/lib/prisma";
export async function POST(req: NextRequest) {
  const secret = process.env.TEZCHECK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook sozlanmagan" }, { status: 503 });
  try {
    const reader = req.body?.getReader();
    if (!reader) return new NextResponse(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 65536) { await reader.cancel(); return new NextResponse(null, { status: 413 }); }
      chunks.push(chunk.value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!validWebhook(raw, req.headers, secret)) return new NextResponse(null, { status: 401 });
    const event = z.object({ id: z.string(), type: z.string(), data: z.object({ external_reference: z.string().nullable(), bill_id: z.string(), environment: z.string() }) }).safeParse(JSON.parse(raw));
    if (!event.success) return new NextResponse(null, { status: 400 });
    if (event.data.type !== "payment.succeeded" || event.data.data.environment !== "live") return NextResponse.json({ received: true });
    const order = await prisma.checkoutOrder.findFirst({ where: { id: event.data.data.external_reference || "", billId: event.data.data.bill_id } });
    // A callback can arrive before the bill creation response is saved. Ask for redelivery.
    if (!order) return new NextResponse(null, { status: 503 });
    await reconcileCheckout(order.id);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "To‘lovni tekshirish yakunlanmadi" }, { status: 503 });
  }
}
