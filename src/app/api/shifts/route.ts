import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
const roles = ["SHOP_ADMIN", "CASHIER"] as const;
const openSchema = z.object({ openingCash: z.number().finite().nonnegative().max(1_000_000_000) });
const closeSchema = z.object({ shiftId: z.string().uuid(), closingCash: z.number().finite().nonnegative().max(1_000_000_000), notes: z.string().max(500).optional() });

async function summarize(shiftId: string, openingCash: number) {
  const sales = await prisma.sale.findMany({ where: { shiftId, status: "COMPLETED" }, include: { payments: true } });
  const returned = await prisma.return.findMany({ where: { shiftId }, select: { cashRefundAmount: true, totalRefundAmount: true } });
  const movements = await prisma.cashMovement.findMany({ where: { shiftId }, select: { type: true, amount: true } });
  const amounts = { CASH: 0, CARD: 0, ELECTRONIC: 0, DEBT: 0 };
  const refunds = returned.reduce((sum, item) => sum + (item.cashRefundAmount ?? item.totalRefundAmount), 0);
  for (const sale of sales) {
    for (const payment of sale.payments) {
      const method = payment.paymentMethod as keyof typeof amounts;
      if (method in amounts) amounts[method] += payment.amount;
    }
  }
  const cashIn = movements.filter((item) => item.type === "IN").reduce((sum, item) => sum + item.amount, 0);
  const cashOut = movements.filter((item) => item.type === "OUT").reduce((sum, item) => sum + item.amount, 0);
  return { salesCount: sales.length, amounts, refunds, cashIn, cashOut, expectedCash: openingCash + amounts.CASH + cashIn - cashOut - refunds };
}

export async function GET(req: NextRequest) {
  const { context, errorResponse } = await requireTenantContext(req, [...roles]);
  if (errorResponse) return errorResponse;
  const { shopId, user } = context!;
  const shifts = await prisma.shift.findMany({ where: { shopId, ...(user.role === "CASHIER" ? { cashierId: user.id } : {}) }, include: { shop: { select: { name: true } }, cashier: { select: { fullName: true } }, cashMovements: { orderBy: { createdAt: "desc" } } }, orderBy: { openedAt: "desc" }, take: 50 });
  const data = await Promise.all(shifts.map(async (shift) => ({ ...shift, mine: shift.cashierId === user.id, summary: await summarize(shift.id, shift.openingCash) })));
  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const { context, errorResponse } = await requireTenantContext(req, [...roles]);
  if (errorResponse) return errorResponse;
  const input = openSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ success: false, error: "Boshlang‘ich naqd summa noto‘g‘ri" }, { status: 400 });
  const { shopId, user } = context!;
  const existing = await prisma.shift.findFirst({ where: { shopId, cashierId: user.id, status: "OPEN" } });
  if (existing) return NextResponse.json({ success: false, error: "Smenangiz allaqachon ochiq" }, { status: 409 });
  try {
    const shift = await prisma.shift.create({ data: { shopId, cashierId: user.id, openingCash: input.data.openingCash } });
    return NextResponse.json({ success: true, data: shift }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Smena ochilmadi. Boshqa ochiq smenani tekshiring" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  const { context, errorResponse } = await requireTenantContext(req, [...roles]);
  if (errorResponse) return errorResponse;
  const input = closeSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ success: false, error: "Yopish ma’lumotlari noto‘g‘ri" }, { status: 400 });
  const { shopId, user } = context!;
  const shift = await prisma.shift.findFirst({ where: { id: input.data.shiftId, shopId, ...(user.role === "CASHIER" ? { cashierId: user.id } : {}) } });
  if (!shift) return NextResponse.json({ success: false, error: "Smena topilmadi" }, { status: 404 });
  if (shift.status !== "OPEN") return NextResponse.json({ success: false, error: "Smena allaqachon yopilgan" }, { status: 409 });
  const result = await prisma.shift.updateMany({ where: { id: shift.id, shopId, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date(), closingCash: input.data.closingCash, notes: input.data.notes || null } });
  if (result.count === 0) return NextResponse.json({ success: false, error: "Smena boshqa joyda yopilgan" }, { status: 409 });
  return NextResponse.json({ success: true, data: { ...shift, status: "CLOSED", closingCash: input.data.closingCash, summary: await summarize(shift.id, shift.openingCash) } });
}
