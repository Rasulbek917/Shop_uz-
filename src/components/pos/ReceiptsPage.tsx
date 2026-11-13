"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ReceiptModal, { type ReceiptModalProps } from "./ReceiptModal";
import { clientApi } from "@/lib/client-api";
import { formatCurrency, getPaymentMethodLabel } from "@/lib/formatters";
import { receiptDate } from "@/lib/formatters";

type Sale = {
  id: string;
  receiptNumber: string;
  createdAt: string;
  payableAmount: number;
  paymentMethod: string;
  status: string;
};
export default function ReceiptsPage({
  canExport,
  canUpgrade,
}: {
  canExport: boolean;
  canUpgrade: boolean;
}) {
  const [data, setData] = useState<{
    sales: Sale[];
    total: number;
    pageSize: number;
  }>({ sales: [], total: 0, pageSize: 25 });
  const [filters, setFilters] = useState({ search: "", from: "", to: "" });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<
    { paymentMethod: string; amount: number; count: number }[]
  >([]);
  const [analyticsError, setAnalyticsError] = useState("");
  const [receipt, setReceipt] = useState<ReceiptModalProps["receipt"]>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    clientApi(`/api/receipts?${query}&page=${page}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, page, refresh]);
  useEffect(() => {
    if (!canExport) return;
    let active = true;
    setAnalytics([]);
    setAnalyticsError("");
    clientApi(`/api/receipts/analytics?${query}`)
      .then((result) => {
        if (active) setAnalytics(result);
      })
      .catch((error) => {
        if (active) setAnalyticsError(error.message);
      });
    return () => {
      active = false;
    };
  }, [canExport, query, refresh]);
  async function view(sale: Sale) {
    setBusy(true);
    setError("");
    try {
      setReceipt(
        await clientApi(`/api/sales/${sale.id}/reprint`, { method: "POST" }),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!canExport || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/receipts/export?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Hisobotni yuklab bo‘lmadi",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "savdoza-cheklar.csv";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cheklar</h1>
          <p className="mt-2 text-sm">
            Chop etilgan va chop etilmagan savdo cheklari shu yerda saqlanadi.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => setRefresh((value) => value + 1)}
          disabled={loading}
        >
          Yangilash
        </button>
      </div>
      <form
        className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(
            new URLSearchParams(
              Object.entries(filters).filter(([, value]) => value),
            ).toString(),
          );
        }}
      >
        <label className="text-sm">
          Chek raqami
          <input
            className="input-field mt-1"
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            maxLength={100}
          />
        </label>
        <label className="text-sm">
          Boshlanish sanasi
          <input
            className="input-field mt-1"
            type="date"
            value={filters.from}
            onChange={(event) =>
              setFilters({ ...filters, from: event.target.value })
            }
          />
        </label>
        <label className="text-sm">
          Tugash sanasi
          <input
            className="input-field mt-1"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) =>
              setFilters({ ...filters, to: event.target.value })
            }
          />
        </label>
        <button className="btn-primary self-end" disabled={loading}>
          Qidirish
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{data.total} ta chek</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn-secondary"
            disabled={!canExport || busy}
            onClick={download}
          >
            CSV yuklab olish · MAX
          </button>
          {!canExport && canUpgrade && (
            <Link
              href="/sozlamalar/tarif?plan=MAX"
              className="text-sm underline"
            >
              Max tarifiga o‘ting
            </Link>
          )}
        </div>
      </div>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-bold text-slate-900">
          To‘lov turlari bo‘yicha savdo tahlili · MAX
        </h2>
        {canExport ? (
          <>
            <p className="my-2 text-xs text-slate-500">
              Tanlangan davrdagi yakunlangan savdolar. Nasiya summasi alohida
              ko‘rsatiladi.
            </p>
            {analyticsError && (
              <p role="alert" className="text-red-700">
                {analyticsError}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {analytics.map((group) => (
                <article
                  className="rounded-xl bg-slate-50 p-4"
                  key={group.paymentMethod}
                >
                  <p className="text-sm">
                    {getPaymentMethodLabel(group.paymentMethod)}
                  </p>
                  <b className="my-2 block text-xl text-emerald-800">
                    {formatCurrency(group.amount)}
                  </b>
                  <small>{group.count} ta savdo</small>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Bu tahlil{" "}
            {canUpgrade ? (
              <>
                qulflangan.{" "}
                <Link className="underline" href="/sozlamalar/tarif?plan=MAX">
                  Max tarifiga o‘ting
                </Link>
              </>
            ) : (
              <>Max tarifidagi do‘kon egasi uchun ochiladi.</>
            )}
          </p>
        )}
      </section>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Chek raqami",
                "Sana va vaqt",
                "Summa",
                "To‘lov",
                "Holati",
                "Chek",
              ].map((label) => (
                <th className="whitespace-nowrap p-4" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-5" colSpan={6}>
                  Yuklanmoqda…
                </td>
              </tr>
            ) : (
              data.sales.map((sale) => (
                <tr className="border-t" key={sale.id}>
                  <td className="p-4 font-mono text-xs">
                    {sale.receiptNumber}
                  </td>
                  <td className="whitespace-nowrap p-4">
                    {receiptDate(sale.createdAt)}
                  </td>
                  <td className="whitespace-nowrap p-4 font-bold">
                    {formatCurrency(sale.payableAmount)}
                  </td>
                  <td className="p-4">
                    {getPaymentMethodLabel(sale.paymentMethod)}
                  </td>
                  <td className="p-4">
                    {sale.status === "COMPLETED"
                      ? "Yakunlangan"
                      : sale.status === "REFUNDED"
                        ? "Qaytarilgan"
                        : sale.status === "CANCELLED"
                          ? "Bekor qilingan"
                          : sale.status}
                  </td>
                  <td className="p-4">
                    <button
                      className="btn-secondary whitespace-nowrap"
                      disabled={busy}
                      onClick={() => view(sale)}
                    >
                      Ko‘rish / chiqarish
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!loading && !data.sales.length && (
              <tr>
                <td className="p-5" colSpan={6}>
                  Bu qidiruv bo‘yicha chek topilmadi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          className="btn-secondary"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          Oldingi
        </button>
        <p>
          {page} / {pages}
        </p>
        <button
          className="btn-secondary"
          disabled={page >= pages || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Keyingi
        </button>
      </div>
      <ReceiptModal
        isOpen={!!receipt}
        receipt={receipt}
        onClose={() => setReceipt(null)}
        isReprint
      />
    </div>
  );
}
