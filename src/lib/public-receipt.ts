import { prisma } from "@/lib/prisma";
import { receiptId } from "./receipt-share";
import { receiptDate, getPaymentMethodLabel } from "./formatters";

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
const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );
const money = (value: number) =>
  value.toLocaleString("uz-UZ", { maximumFractionDigits: 2 });

const statusLabels: Record<string, string> = {
  COMPLETED: "Yakunlangan",
  REFUNDED: "Qaytarilgan",
  CANCELLED: "Bekor qilingan",
};

export function receiptImage(receipt: PublicReceipt): string {
  const lines: string[] = [
    receipt.shop.name,
    `Chek ${receipt.receiptNumber}`,
    receiptDate(receipt.createdAt),
    `Holati ${statusLabels[receipt.status] || receipt.status}`,
    "",
  ];
  for (const item of receipt.items) {
    const name = Array.from(item.product.name);
    for (let offset = 0; offset < name.length; offset += 38)
      lines.push(name.slice(offset, offset + 38).join(""));
    lines.push(
      `${item.quantity} × ${money(item.unitPrice)} = ${money(item.totalPrice)} so‘m`,
      "",
    );
  }
  lines.push(
    `Jami ${money(receipt.totalAmount)} so‘m`,
    `Chegirma ${money(receipt.discountAmount)} so‘m`,
    `Soliq ${money(receipt.taxAmount)} so‘m`,
    `To‘lov ${money(receipt.payableAmount)} so‘m`,
    getPaymentMethodLabel(receipt.paymentMethod),
    "",
    "Xaridingiz uchun rahmat!",
    "Ichki savdo cheki",
  );
  const wrapped = lines.flatMap((line) => {
    const characters = Array.from(line);
    if (!characters.length) return [""];
    const parts: string[] = [];
    for (let offset = 0; offset < characters.length; offset += 42)
      parts.push(characters.slice(offset, offset + 42).join(""));
    return parts;
  });
  const height = wrapped.length * 26 + 48;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${height}" viewBox="0 0 480 ${height}"><rect width="480" height="${height}" fill="white"/><g font-family="monospace" font-size="16" fill="#142d25">${wrapped.map((line, index) => `<text x="24" y="${32 + index * 26}">${escapeXml(line)}</text>`).join("")}</g></svg>`;
}
