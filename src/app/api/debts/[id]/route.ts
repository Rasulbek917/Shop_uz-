import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { debtSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;
    const debt = await prisma.debt.findFirst({
      where: { id: params.id, shopId },
    });

    if (!debt) {
      return NextResponse.json({ success: false, error: "Qarz topilmadi" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: debt });
  } catch (error) {
    logger.error("GET /api/debts/:id xatolik", { error, route: "/api/debts/:id" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, ["SUPER_ADMIN", "SHOP_ADMIN"]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const body = await req.json();
    const validated = debtSchema.partial().safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.errors[0]?.message || "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const existing = await prisma.debt.findFirst({
      where: { id: params.id, shopId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Qarz topilmadi" }, { status: 404 });
    }

    const updateData: any = {};
    if (validated.data.firstName !== undefined) updateData.firstName = validated.data.firstName.trim();
    if (validated.data.lastName !== undefined) updateData.lastName = validated.data.lastName.trim();
    if (validated.data.phone !== undefined) updateData.phone = validated.data.phone?.trim() || null;
    if (validated.data.amount !== undefined) updateData.amount = Number(validated.data.amount || 0);
    if (validated.data.description !== undefined) updateData.description = validated.data.description?.trim() || null;
    if (validated.data.status !== undefined) updateData.status = validated.data.status;

    const updated = await prisma.debt.update({
      where: { id: params.id },
      data: updateData,
    });

    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "QARZ_TAHRIRLANDI",
      entity: "Debt",
      entityId: params.id,
      details: `${existing.firstName} ${existing.lastName} qarzi tahrirlandi. Yangi miqdor: ${updated.amount} so'm`,
    });

    return NextResponse.json({
      success: true,
      message: "Qarz ma'lumotlari yangilandi",
      data: updated,
    });
  } catch (error) {
    logger.error("PATCH /api/debts/:id xatolik", { error, route: "/api/debts/:id" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, ["SUPER_ADMIN", "SHOP_ADMIN"]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const debt = await prisma.debt.findFirst({
      where: { id: params.id, shopId },
    });

    if (!debt) {
      return NextResponse.json({ success: false, error: "Qarz topilmadi" }, { status: 404 });
    }

    await prisma.debt.delete({
      where: { id: params.id },
    });

    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "QARZ_OCHIRILDI",
      entity: "Debt",
      entityId: params.id,
      details: `${debt.firstName} ${debt.lastName} qarzi o‘chirildi`,
    });

    return NextResponse.json({
      success: true,
      message: "Qarz muvaffaqiyatli o‘chirildi",
    });
  } catch (error) {
    logger.error("DELETE /api/debts/:id xatolik", { error, route: "/api/debts/:id" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}
