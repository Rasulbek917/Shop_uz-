import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { debtSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const { shopId } = context!;
    const search = req.nextUrl.searchParams.get("search")?.trim() || "";

    const where: any = { shopId };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const debts = await prisma.debt.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: debts });
  } catch (error) {
    logger.error("GET /api/debts xatolik", { error, route: "/api/debts" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, ["SUPER_ADMIN", "SHOP_ADMIN"]);
    if (errorResponse) return errorResponse;

    const { user, shopId } = context!;
    const body = await req.json();
    const validated = debtSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.errors[0]?.message || "Ma'lumotlar xato" },
        { status: 400 }
      );
    }

    const debt = await prisma.debt.create({
      data: {
        shopId,
        firstName: validated.data.firstName.trim(),
        lastName: validated.data.lastName.trim(),
        phone: validated.data.phone?.trim() || null,
        amount: Number(validated.data.amount || 0),
        description: validated.data.description?.trim() || null,
        status: validated.data.status || "OPEN",
      },
    });

    await logAudit({
      shopId,
      userId: user.id,
      userName: user.fullName,
      action: "QARZ_QOSHILDI",
      entity: "Debt",
      entityId: debt.id,
      details: `${debt.firstName} ${debt.lastName} uchun ${debt.amount} so'm qarz qo'shildi`,
    });

    return NextResponse.json({
      success: true,
      message: "Qarz muvaffaqiyatli qo‘shildi",
      data: debt,
    });
  } catch (error) {
    logger.error("POST /api/debts xatolik", { error, route: "/api/debts" });
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}
