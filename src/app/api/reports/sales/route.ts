import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const dayInTashkent = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });

export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN", "SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;
    const query = req.nextUrl.searchParams;
    const today = dayInTashkent(new Date());
    const from = query.get("from") || today;
    const to = query.get("to") || today;
    const cashierId = query.get("cashierId") || "";
    const paymentMethod = query.get("paymentMethod") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || (paymentMethod && !["CASH", "CARD", "ELECTRONIC", "DEBT"].includes(paymentMethod))) {
      return NextResponse.json({ success: false, error: "Sana yoki to‘lov turi noto‘g‘ri" }, { status: 400 });
    }
    const start = new Date(`${from}T00:00:00+05:00`);
    const end = new Date(`${to}T23:59:59.999+05:00`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || end.getTime() - start.getTime() > 93 * 86400000) {
      return NextResponse.json({ success: false, error: "1–93 kunlik davrni tanlang" }, { status: 400 });
    }
    const saleFilter: Prisma.SaleWhereInput = {
      shopId: context!.shopId,
      status: "COMPLETED",
      ...(cashierId ? { cashierId } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
    };
    const [sales, returns, cashiers] = await Promise.all([
      prisma.sale.findMany({
        where: { ...saleFilter, createdAt: { gte: start, lte: end } },
        include: { cashier: { select: { fullName: true } }, customer: { select: { name: true } }, items: { include: { product: { select: { name: true, unit: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.return.findMany({
        where: { shopId: context!.shopId, createdAt: { gte: start, lte: end }, sale: saleFilter },
        include: { items: { include: { product: { select: { name: true, unit: true } } } }, sale: { select: { cashierId: true, paymentMethod: true, payableAmount: true, taxAmount: true, items: { select: { id: true, purchasePrice: true } } } } },
      }),
      prisma.user.findMany({ where: { shopId: context!.shopId, role: { in: ["SHOP_ADMIN", "CASHIER"] }, status: "ACTIVE" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    ]);

    const methods = new Map<string, { method: string; amount: number; count: number; refunds: number }>();
    for (const method of ["CASH", "CARD", "ELECTRONIC", "DEBT"]) methods.set(method, { method, amount: 0, count: 0, refunds: 0 });
    const days = new Map<string, { date: string; sales: number; refunds: number; count: number }>();
    const products = new Map<string, { id: string; name: string; unit: string; quantity: number; revenue: number }>();
    let gross = 0;
    let cost = 0;
    let tax = 0;
    for (const sale of sales) {
      gross += sale.payableAmount;
      tax += sale.taxAmount;
      const method = methods.get(sale.paymentMethod);
      if (method) { method.amount += sale.payableAmount; method.count += 1; }
      const day = dayInTashkent(sale.createdAt);
      const row = days.get(day) || { date: day, sales: 0, refunds: 0, count: 0 };
      row.sales += sale.payableAmount; row.count += 1; days.set(day, row);
      for (const item of sale.items) {
        cost += item.purchasePrice * item.quantity;
        const product = products.get(item.productId) || { id: item.productId, name: item.product.name, unit: item.product.unit, quantity: 0, revenue: 0 };
        product.quantity += item.quantity;
        product.revenue += item.totalPrice;
        products.set(item.productId, product);
      }
    }
    let refunds = 0;
    let refundedCost = 0;
    let refundedTax = 0;
    for (const item of returns) {
      refunds += item.totalRefundAmount;
      refundedTax += item.sale.payableAmount > 0 ? item.sale.taxAmount * item.totalRefundAmount / item.sale.payableAmount : 0;
      const method = methods.get(item.sale.paymentMethod);
      if (method) method.refunds += item.totalRefundAmount;
      const day = dayInTashkent(item.createdAt);
      const row = days.get(day) || { date: day, sales: 0, refunds: 0, count: 0 };
      row.refunds += item.totalRefundAmount; days.set(day, row);
      for (const returned of item.items) {
        refundedCost += (item.sale.items.find((original) => original.id === returned.saleItemId)?.purchasePrice || 0) * returned.quantity;
        const product = products.get(returned.productId) || { id: returned.productId, name: returned.product.name, unit: returned.product.unit, quantity: 0, revenue: 0 };
        product.quantity -= returned.quantity; product.revenue -= returned.totalRefund;
        products.set(returned.productId, product);
      }
    }
    const summary = {
      salesCount: sales.length,
      returnsCount: returns.length,
      gross,
      refunds,
      net: gross - refunds,
      profit: gross - refunds - (tax - refundedTax) - (cost - refundedCost),
    };
    return NextResponse.json({ success: true, data: {
      from, to, summary, cashiers,
      methods: [...methods.values()],
      days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
      products: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 20),
      sales: sales.map((sale) => ({ id: sale.id, receiptNumber: sale.receiptNumber, createdAt: sale.createdAt, cashier: sale.cashier.fullName, customer: sale.customer?.name || "", paymentMethod: sale.paymentMethod, payableAmount: sale.payableAmount, itemsCount: sale.items.reduce((sum, item) => sum + item.quantity, 0) })),
    } });
  } catch (error) {
    logger.error("Sales report error", { error });
    return NextResponse.json({ success: false, error: "Sotuvlar hisobotini yuklab bo‘lmadi" }, { status: 500 });
  }
}
