import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext, requireApiAuth } from "@/lib/tenant";
import { posSaleSchema, startPosPayment, posPaymentView } from "@/lib/payments/pos";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
    const { user, errorResponse } = await requireApiAuth(req, ["SHOP_ADMIN", "CASHIER"]);
    if (errorResponse)
        return errorResponse;
    const rows = await prisma.posPayment.findMany({ where: { shopId: user.shopId || "", status: "PENDING", sale: user.role === "CASHIER" ? { cashierId: user.id } : undefined }, include: { sale: { include: { items: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ success: true, data: rows.map(posPaymentView) });
}
export async function POST(req: NextRequest) {
    const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN", "CASHIER"]);
    if (errorResponse)
        return errorResponse;
    let input: z.infer<typeof posSaleSchema> | undefined;
    try {
        input = posSaleSchema.parse(await req.json());
        const order = await startPosPayment(input, context!);
        return NextResponse.json({ success: true, data: posPaymentView(order) });
    }
    catch (error) {
        // The provider may have accepted a bill before the connection failed. Keep the
        // stock hold visible and resume it instead of inviting a second checkout.
        if (input) {
            const saved = await prisma.posPayment.findUnique({ where: { requestKey: `${context!.shopId}:${input.idempotencyKey}` }, include: { sale: { include: { items: true } } } });
            if (saved && (context!.user.role !== "CASHIER" || saved.sale.cashierId === context!.user.id) && ![403, 409].includes((error as { status?: number }).status || 0))
                return NextResponse.json({ success: true, data: { ...posPaymentView(saved), warning: (error as Error).message } });
        }
        return NextResponse.json({ success: false, error: error instanceof z.ZodError ? "Savat ma’lumotlari noto‘g‘ri" : (error as Error).message }, { status: 400 });
    }
}
