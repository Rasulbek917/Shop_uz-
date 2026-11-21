import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { menuVisibilityFrom, optionalMenuItems } from "@/lib/menu-visibility";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const shop = await prisma.shop.findUnique({
      where: { id: context!.shopId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        taxRate: true,
        taxIncluded: true,
        menuVisibility: true,
      },
    });

    if (!shop) {
      return NextResponse.json(
        { success: false, error: { code: "SHOP_NOT_FOUND", message: "Do‘kon topilmadi" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: shop });
  } catch (error) {
    logger.error("Shop settings GET error", { error: error });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "Xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}

const settingsUpdateSchema = z.object({
  taxRate: z.number().min(0).max(100).optional(),
  taxIncluded: z.boolean().optional(),
  address: z.string().max(255).optional(),
  phone: z.string().max(32).optional(),
  menuVisibility: z.object(Object.fromEntries(
    optionalMenuItems.map(({ key }) => [key, z.boolean().optional()])
  ) as Record<(typeof optionalMenuItems)[number]["key"], z.ZodOptional<z.ZodBoolean>>).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req, ["SHOP_ADMIN"]);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => null);
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const shop = await prisma.$transaction(async (tx) => {
      const shopId = context!.shopId;
      await tx.$queryRaw`SELECT "id" FROM "Shop" WHERE "id" = ${shopId} FOR UPDATE`;
      const current = await tx.shop.findUniqueOrThrow({
        where: { id: shopId },
        select: { menuVisibility: true },
      });
      return tx.shop.update({
        where: { id: shopId },
        data: {
          ...parsed.data,
          menuVisibility: parsed.data.menuVisibility
            ? { ...menuVisibilityFrom(current.menuVisibility), ...parsed.data.menuVisibility }
            : undefined,
        },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          taxRate: true,
          taxIncluded: true,
          menuVisibility: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: shop });
  } catch (error) {
    logger.error("Shop settings PATCH error", { error: error });
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "Xatolik yuz berdi" } },
      { status: 500 }
    );
  }
}
