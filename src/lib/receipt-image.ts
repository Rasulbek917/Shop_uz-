import { createElement } from "react";
import { readFile } from "fs/promises";
import { join } from "path";
import { ImageResponse } from "next/og";
import type { PublicReceipt } from "./public-receipt";
import { receiptDate, getPaymentMethodLabel } from "./formatters";

const statusLabels: Record<string, string> = {
  COMPLETED: "Yakunlangan",
  REFUNDED: "Qaytarilgan",
  CANCELLED: "Bekor qilingan",
};
const money = (value: number) =>
  value.toLocaleString("uz-UZ", { maximumFractionDigits: 2 });

export async function receiptImage(
  receipt: PublicReceipt,
): Promise<ArrayBuffer> {
  const lines = [
    receipt.shop.name,
    `Chek ${receipt.receiptNumber}`,
    receiptDate(receipt.createdAt),
    `Holati ${statusLabels[receipt.status] || receipt.status}`,
    "",
  ];
  for (const item of receipt.items) {
    lines.push(
      item.product.name,
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
    for (let offset = 0; offset < characters.length; offset += 28)
      parts.push(characters.slice(offset, offset + 28).join(""));
    return parts;
  });
  const font = await readFile(join(process.cwd(), "public/fonts/receipt.ttf"));
  const image = new ImageResponse(
    createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          backgroundColor: "white",
          color: "#142d25",
          width: "100%",
          height: "100%",
          padding: 32,
          fontSize: 20,
          fontFamily: "Receipt",
        },
      },
      ...wrapped.map((line, index) =>
        createElement(
          "div",
          {
            key: index,
            style: {
              display: "flex",
              height: 30,
              flexShrink: 0,
              lineHeight: "30px",
              fontWeight: index === 0 ? 700 : 400,
            },
          },
          line || " ",
        ),
      ),
    ),
    {
      width: 640,
      height: wrapped.length * 30 + 64,
      fonts: [
        {
          name: "Receipt",
          data: Uint8Array.from(font).buffer,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );
  // Consume the stream here so render failures return an error before any file is sent.
  return image.arrayBuffer();
}
