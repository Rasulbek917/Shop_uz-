import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { receiptToken } from "@/lib/receipt-share";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Savdoza offline cheki",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function OfflineReceipt({
  params: pendingParams,
}: {
  params: Promise<{ key: string }>;
}) {
  const params = await pendingParams;
  if (!/^MOB-[a-f0-9]{64}$/.test(params.key)) notFound();
  const sale = await prisma.sale.findUnique({
    where: { idempotencyKey: params.key },
    select: { id: true },
  });
  if (sale) redirect(`/chek/${receiptToken(sale.id)}`);
  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-bold">Chek sinxronlanmoqda</h1>
      <p className="my-4">
        Savdo telefonda saqlangan. Sotuvchi internetga ulangach chek
        tafsilotlari shu havolada ochiladi.
      </p>
      <a className="btn-primary" href={`/chek/offline/${params.key}`}>
        Qayta tekshirish
      </a>
    </main>
  );
}
