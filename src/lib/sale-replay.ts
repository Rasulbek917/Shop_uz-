import { prisma } from "./prisma";
import { BusinessError } from "./onboarding";

export async function saleReplay(shopId: string, key: string) {
  const sale = await prisma.sale.findFirst({
    where: { shopId, idempotencyKey: key },
    include: {
      shop: { select: { name: true, phone: true, address: true } },
      cashier: { select: { fullName: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!sale) return null;
  return {
    ...sale,
    shopName: sale.shop.name,
    shopPhone: sale.shop.phone,
    shopAddress: sale.shop.address,
    cashierName: sale.cashier.fullName,
    items: sale.items.map((item) => ({
      ...item,
      productName: item.product.name,
    })),
  };
}
export function assertReplay(
  sale: NonNullable<Awaited<ReturnType<typeof saleReplay>>>,
  input: {
    paymentMethod: string;
    discountAmount: number;
    paidAmount?: number;
    customerId?: string | null;
    expectedTotal?: number;
    items: {
      batchId: string;
      productId: string;
      quantity: number;
      unitPrice: number;
      discount: number;
    }[];
  },
) {
  const rows = (items: typeof input.items) =>
    items
      .map((item) =>
        [
          item.batchId,
          item.productId,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.discount),
        ].join(":"),
      )
      .sort();
  if (
    (sale.customerId || null) !== (input.customerId || null) ||
    (input.expectedTotal !== undefined &&
      Math.abs(sale.payableAmount - input.expectedTotal) > 0.5) ||
    sale.paymentMethod !== input.paymentMethod ||
    sale.discountAmount !== Math.round(input.discountAmount) ||
    (input.paidAmount !== undefined &&
      sale.paidAmount !== Math.round(input.paidAmount)) ||
    JSON.stringify(rows(sale.items)) !== JSON.stringify(rows(input.items))
  ) {
    throw new BusinessError(
      "Bu savdo identifikatori boshqa savdo uchun ishlatilgan. Sinxronlashni tekshiring.",
      409,
    );
  }
}
