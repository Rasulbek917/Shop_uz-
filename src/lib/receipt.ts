import { prisma } from "@/lib/prisma";

/**
 * Do'kon uchun noyob chek raqamini yaratadi.
 *
 * `receiptNumber` butun tizim bo'ylab unikal (unique) bo'lgani uchun raqamga
 * do'konning qisqa kodi ham qo'shiladi. Aks holda ikki xil do'kon bir kunda
 * bir xil tartib raqamini (masalan CHK-20261015-0001) hosil qilib, to'qnashuv
 * yuzaga keladi.
 *
 * Namuna: CHK-20261015-A1B2C3-0001 yoki QARZ-20261015-A1B2C3-0001
 */
export async function generateReceiptNumber(
  shopId: string,
  prefixType: "CHK" | "QARZ" = "CHK"
): Promise<string> {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;

  const shopCode = shopId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const prefix = `${prefixType}-${dateStr}-${shopCode}-`;

  const lastSale = await prisma.sale.findFirst({
    where: { shopId, receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });

  let seq = 1;
  if (lastSale) {
    const lastSeq = parseInt(lastSale.receiptNumber.replace(prefix, ""), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}
