import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant";
import { categorySchema } from "@/lib/validations";
import { platformError } from "@/lib/platform-api";

export async function PATCH(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SHOP_ADMIN",
      "SUPER_ADMIN",
      "WAREHOUSEMAN",
    ]);
    if (errorResponse) return errorResponse;
    const data = categorySchema.parse(await req.json());
    const changed = await prisma.category.updateMany({
      where: { id: params.id, shopId: context!.shopId },
      data,
    });
    if (!changed.count)
      return NextResponse.json(
        { success: false, error: "Kategoriya topilmadi" },
        { status: 404 },
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      return NextResponse.json(
        { success: false, error: "Bu nomdagi kategoriya mavjud" },
        { status: 409 },
      );
    return platformError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  try {
    const { context, errorResponse } = await requireTenantContext(req, [
      "SHOP_ADMIN",
      "SUPER_ADMIN",
      "WAREHOUSEMAN",
    ]);
    if (errorResponse) return errorResponse;
    // Only an empty category can be deleted.
    const category = await prisma.category.findFirst({
      where: { id: params.id, shopId: context!.shopId },
      select: { _count: { select: { products: true } } },
    });
    if (!category)
      return NextResponse.json(
        { success: false, error: "Kategoriya topilmadi" },
        { status: 404 },
      );
    if (category._count.products)
      return NextResponse.json(
        {
          success: false,
          error: "Avval mahsulotlarni boshqa kategoriyaga o‘tkazing",
        },
        { status: 409 },
      );
    const deleted = await prisma.category.deleteMany({
      where: { id: params.id, shopId: context!.shopId, products: { none: {} } },
    });
    if (!deleted.count)
      return NextResponse.json(
        { success: false, error: "Kategoriya o‘zgargan. Ro‘yxatni yangilang." },
        { status: 409 },
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    return platformError(error);
  }
}
