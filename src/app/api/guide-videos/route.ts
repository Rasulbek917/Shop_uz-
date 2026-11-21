import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { defaultGuideLessons, isYouTubeUrl, mergeGuideLessons, type GuideLesson } from "@/lib/guide-lessons";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const localized = z.object({ uz: z.string().trim().min(2).max(160), en: z.string().trim().min(2).max(160) });
const steps = z.object({ uz: z.array(z.string().trim().min(2).max(300)).min(1).max(10), en: z.array(z.string().trim().min(2).max(300)).min(1).max(10) });
const lessonSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  category: z.enum(["setup", "products", "inventory", "sales", "finance", "reports", "staff"]),
  title: localized,
  description: localized,
  steps,
  sourceUrl: z.string().trim().min(1).max(1000).refine((value) => value.startsWith("/media/") || isYouTubeUrl(value) || (() => { try { const url = new URL(value); return url.protocol === "https:" && /\.mp4(?:$|\?)/i.test(url.pathname + url.search); } catch { return false; } })(), "MP4 yoki YouTube havolasi kiriting"),
  startSeconds: z.number().min(0).max(36000),
  endSeconds: z.number().min(1).max(36000),
}).refine((value) => value.endSeconds > value.startSeconds, "Tugash vaqti boshlanishdan keyin bo‘lishi kerak");

function savedLessons(value: unknown): GuideLesson[] {
  return Array.isArray(value) ? value.filter((lesson) => lesson && typeof lesson.id === "string") as GuideLesson[] : [];
}

async function readLessons(shopId: string) {
  if (!shopId) return defaultGuideLessons;
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { guideVideos: true } });
  return mergeGuideLessons(savedLessons(shop?.guideVideos));
}

export async function GET(req: NextRequest) {
  const { context, errorResponse } = await requireTenantContext(req);
  if (errorResponse) return errorResponse;
  try { return NextResponse.json({ success: true, data: await readLessons(context!.shopId) }); }
  catch (error) { logger.error("Guide videos GET error", { error }); return NextResponse.json({ success: false, error: "Video darslar yuklanmadi" }, { status: 500 }); }
}

async function mutate(req: NextRequest, mode: "POST" | "PATCH" | "DELETE") {
  const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN"]);
  if (errorResponse) return errorResponse;
  const shopId = context!.shopId;
  const body = await req.json().catch(() => null);
  const parsed = mode === "DELETE" ? z.object({ id: z.string().min(1) }).safeParse(body) : lessonSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Ma’lumot noto‘g‘ri" }, { status: 400 });
  try {
    const lessons = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Shop" WHERE "id" = ${shopId} FOR UPDATE`;
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId }, select: { guideVideos: true } });
      const saved = savedLessons(shop.guideVideos);
      const id = parsed.data.id;
      if (mode === "DELETE") {
        if (!id || !mergeGuideLessons(saved).some((lesson) => lesson.id === id)) throw new Error("Dars topilmadi");
        const next = saved.filter((lesson) => lesson.id !== id);
        await tx.shop.update({ where: { id: shopId }, data: { guideVideos: next } });
        return mergeGuideLessons(next);
      }
      const data = parsed.data as z.infer<typeof lessonSchema>;
      if (mode === "PATCH" && (!id || !mergeGuideLessons(saved).some((lesson) => lesson.id === id))) throw new Error("Dars topilmadi");
      if (mode === "POST" && id) throw new Error("Yangi darsda ID bo‘lmasligi kerak");
      const lesson: GuideLesson = { ...data, id: id || crypto.randomUUID(), custom: !defaultGuideLessons.some((item) => item.id === id) };
      const next = [...saved.filter((item) => item.id !== lesson.id), lesson];
      await tx.shop.update({ where: { id: shopId }, data: { guideVideos: next } });
      return mergeGuideLessons(next);
    });
    return NextResponse.json({ success: true, data: lessons });
  } catch (error) {
    logger.error(`Guide videos ${mode} error`, { error });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Video darsni saqlab bo‘lmadi" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) { return mutate(req, "POST"); }
export async function PATCH(req: NextRequest) { return mutate(req, "PATCH"); }
export async function DELETE(req: NextRequest) { return mutate(req, "DELETE"); }
