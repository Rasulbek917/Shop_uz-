import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN"]);
  if (errorResponse) return errorResponse;
  const { shopId } = context!;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [todayMethods, monthMethods, todayReturns, monthReturns, receivables, supplierDebt, recentSales, shifts] = await Promise.all([
    prisma.sale.groupBy({ by: ["paymentMethod"], where: { shopId, status: "COMPLETED", createdAt: { gte: todayStart } }, _sum: { payableAmount: true }, _count: { _all: true } }),
    prisma.sale.groupBy({ by: ["paymentMethod"], where: { shopId, status: "COMPLETED", createdAt: { gte: monthStart } }, _sum: { payableAmount: true }, _count: { _all: true } }),
    prisma.return.aggregate({ where: { shopId, createdAt: { gte: todayStart } }, _sum: { totalRefundAmount: true, cashRefundAmount: true } }),
    prisma.return.aggregate({ where: { shopId, createdAt: { gte: monthStart } }, _sum: { totalRefundAmount: true, cashRefundAmount: true } }),
    prisma.debt.aggregate({ where: { shopId, status: "OPEN" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.supplier.aggregate({ where: { shopId }, _sum: { debt: true } }),
    prisma.sale.findMany({ where: { shopId }, select: { id: true, receiptNumber: true, createdAt: true, payableAmount: true, paymentMethod: true, cashier: { select: { fullName: true } }, customer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.shift.findMany({ where: { shopId, status: "OPEN" }, select: { id: true, openingCash: true, openedAt: true, cashier: { select: { fullName: true } } }, orderBy: { openedAt: "desc" } }),
  ]);
  const normalize = (rows: typeof todayMethods) => rows.map((row) => ({ method: row.paymentMethod, amount: row._sum.payableAmount || 0, count: row._count._all }));
  return NextResponse.json({ success: true, data: {
    today: { methods: normalize(todayMethods), refunds: todayReturns._sum.totalRefundAmount || 0, cashRefunds: todayReturns._sum.cashRefundAmount || 0 },
    month: { methods: normalize(monthMethods), refunds: monthReturns._sum.totalRefundAmount || 0, cashRefunds: monthReturns._sum.cashRefundAmount || 0 },
    receivables: { amount: receivables._sum.amount || 0, count: receivables._count._all },
    supplierDebt: supplierDebt._sum.debt || 0,
    recentSales,
    shifts,
  } });
}
