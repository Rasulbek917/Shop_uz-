import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/tenant";
import { findPosPayment, reconcilePosPayment, cancelPosPayment, posPaymentView } from "@/lib/payments/pos";
import { saleReplay } from "@/lib/sale-replay";
export const dynamic = "force-dynamic";
async function operate(req: NextRequest, id: string, cancel: boolean) {
    const { user, errorResponse } = await requireApiAuth(req, ["SHOP_ADMIN", "CASHIER"]);
    if (errorResponse)
        return errorResponse;
    try {
        const order = await findPosPayment(id);
        if (!order || order.shopId !== user.shopId || (user.role === "CASHIER" && order.sale.cashierId !== user.id))
            return NextResponse.json({ success: false, error: "To‘lov topilmadi" }, { status: 404 });
        const current = cancel ? await cancelPosPayment(order) : await reconcilePosPayment(order);
        const receipt = current.status === "PAID" ? await saleReplay(current.shopId, `POS-${current.requestKey}`) : null;
        return NextResponse.json({ success: true, data: { ...posPaymentView(current), receipt } });
    }
    catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message || "To‘lov natijasini tekshirib bo‘lmadi" }, { status: 409 });
    }
}
export function GET(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) { return operate(req, params.id, false); }
export function DELETE(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) { return operate(req, params.id, true); }
