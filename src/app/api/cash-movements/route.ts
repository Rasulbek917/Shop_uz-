import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";

const schema = z.object({ type: z.enum(["IN", "OUT"]), amount: z.number().finite().positive().max(1_000_000_000), note: z.string().trim().min(2).max(300) });

export async function POST(req: NextRequest) {
  const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN", "CASHIER"]);
  if (errorResponse) return errorResponse;
  const input = schema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ success: false, error: "Kassa amali uchun tur, summa va izohni kiriting" }, { status: 400 });
  const { shopId, user } = context!;
  const shift = await prisma.shift.findFirst({ where: { shopId, cashierId: user.id, status: "OPEN" }, select: { id: true } });
  if (!shift) return NextResponse.json({ success: false, error: "Avval smenani oching" }, { status: 409 });
  const movement = await prisma.cashMovement.create({ data: { shopId, cashierId: user.id, shiftId: shift.id, type: input.data.type, amount: input.data.amount, note: input.data.note } });
  return NextResponse.json({ success: true, data: movement }, { status: 201 });
}
