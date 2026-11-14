import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicReceipt } from "@/lib/public-receipt";
import PublicReceiptImage from "@/components/pos/PublicReceiptImage";
import { receiptDate } from "@/lib/formatters";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Savdoza savdo cheki",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function ReceiptPage({
  params: pendingParams,
}: {
  params: Promise<{ token: string }>;
}) {
  const params = await pendingParams;
  const receipt = await publicReceipt(params.token);
  if (!receipt) notFound();
  const imageUrl = `/api/receipts/${encodeURIComponent(params.token)}/image?format=png`;
  return (
    <main className="mx-auto max-w-xl p-5">
      <p className="text-sm font-bold text-emerald-800">SAVDOZA</p>
      <h1 className="my-4 text-2xl font-bold text-slate-900">
        {receipt.shop.name}
      </h1>
      <p>Chek {receipt.receiptNumber}</p>
      <p className="mt-2 text-sm">
        {receiptDate(receipt.createdAt)} · Toshkent vaqti
      </p>
      <p className="my-3 text-sm">
        {receipt.status === "COMPLETED"
          ? "Savdo yakunlangan"
          : receipt.status === "REFUNDED"
            ? "Qaytarilgan"
            : receipt.status === "CANCELLED"
              ? "Bekor qilingan"
              : receipt.status}
      </p>
      <PublicReceiptImage
        imageUrl={imageUrl}
        filename={`chek-${receipt.receiptNumber.replace(/[^A-Za-z0-9_-]/g, "_")}.png`}
        description={`${receipt.receiptNumber} raqamli chek, ${receiptDate(receipt.createdAt)}`}
      />
      <p className="mt-5 text-xs text-slate-500">
        Ichki savdo cheki. Havolani ochgan odam chek ma’lumotlarini ko‘ra oladi.
      </p>
    </main>
  );
}
