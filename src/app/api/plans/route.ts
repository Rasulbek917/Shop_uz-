import { PLAN_PRICES } from "@/lib/plans";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/tenant";
import { platformError } from "@/lib/platform-api";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ success: true, data: (await prisma.plan.findMany({ orderBy: { price: "asc" } })).map(plan => ({ ...plan, price: PLAN_PRICES[plan.code as keyof typeof PLAN_PRICES] ?? plan.price })) }); }
  catch (e) { return platformError(e); }
}
export async function PUT(req: NextRequest) {
  const auth = await requireApiAuth(req, ["SUPER_ADMIN"]); if (auth.errorResponse) return auth.errorResponse;
  try {
    const body = z.object({ code: z.enum(["PRO", "MAX"]), price: z.number().int().min(0).max(100000000), enabled: z.boolean(), paymentInstructions: z.string().trim().max(2000) }).refine(v => !v.enabled || (v.price > 0 && v.paymentInstructions.length > 5), "Tarifni yoqish uchun narx va to‘lov rekvizitlarini kiriting").parse(await req.json());
    const { code, ...data } = body;
    data.price = PLAN_PRICES[code];
    return NextResponse.json({ success: true, data: await prisma.plan.upsert({ where: { code }, create: { code, name: code === "PRO" ? "Pro" : "Max", ...data }, update: data }) });
  } catch (e) { return platformError(e); }
}
