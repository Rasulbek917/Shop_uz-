import { prisma } from "@/lib/prisma";
import { receiptId } from "./receipt-share";

export async function publicReceipt(token: string) {
  const id = receiptId(token);
  if (!id) return null;
  return prisma.sale.findUnique({
    where: { id },
    select: {
      receiptNumber: true,
      createdAt: true,
      totalAmount: true,
      discountAmount: true,
      taxAmount: true,
      payableAmount: true,
      paymentMethod: true,
      status: true,
      shop: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          product: { select: { name: true } },
        },
      },
    },
  });
}
export type PublicReceipt = NonNullable<
  Awaited<ReturnType<typeof publicReceipt>>
>;
