"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Printer, RefreshCw } from "lucide-react";
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from "@/lib/formatters";

type Report = {
  from: string; to: string;
  summary: { salesCount: number; returnsCount: number; gross: number; refunds: number; net: number; profit: number };
  cashiers: Array<{ id: string; fullName: string }>;
  methods: Array<{ method: string; amount: number; count: number; refunds: number }>;
  days: Array<{ date: string; sales: number; refunds: number; count: number }>;
  products: Array<{ id: string; name: string; unit: string; quantity: number; revenue: number }>;
  sales: Array<{ id: string; receiptNumber: string; createdAt: string; cashier: string; customer: string; paymentMethod: string; payableAmount: number; itemsCount: number }>;
};
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export default function SalesReportPage() {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [cashierId, setCashierId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (filters: { from: string; to: string; cashierId: string; paymentMethod: string }) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/reports/sales?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Hisobot yuklanmadi");
      setReport(result.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Hisobot yuklanmadi"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load({ from, to, cashierId: "", paymentMethod: "" }); /* first load */ }, [load]);
  const refresh = () => void load({ from, to, cashierId, paymentMethod });
  const download = () => {
    if (!report) return;
    const rows = [
      ["Chek", "Sana", "Kassir", "Mijoz", "To‘lov", "Mahsulotlar", "Summa"],
      ...report.sales.map((sale) => [sale.receiptNumber, formatDateTime(sale.createdAt), sale.cashier, sale.customer, getPaymentMethodLabel(sale.paymentMethod), sale.itemsCount, sale.payableAmount]),
    ];
    const blob = new Blob(["\uFEFF", rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `sotuvlar-${report.from}-${report.to}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const maxDay = Math.max(1, ...(report?.days.map((day) => Math.abs(day.sales - day.refunds)) || []));
  return <main className="space-y-5 bg-[#f3f5f9] pb-10">
    <header className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-[#1e50b3]">HISOBOTLAR / SOTUVLAR</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Sotuvlar hisoboti</h1><p className="mt-1 text-sm text-slate-500">Cheklar, to‘lovlar, qaytarishlar va sof foyda</p></div><Link href="/admin/hisobotlar" className="text-sm font-semibold text-[#1e50b3]">Barcha hisobotlar</Link></div></header>
    <form onSubmit={(event) => { event.preventDefault(); refresh(); }} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <label className="text-xs font-semibold text-slate-600">Boshlanish<input aria-label="Boshlanish sanasi" type="date" required value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold text-slate-600">Tugash<input aria-label="Tugash sanasi" type="date" required value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold text-slate-600">Kassir<select value={cashierId} onChange={(event) => setCashierId(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Barcha kassirlar</option>{report?.cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.fullName}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">To‘lov turi<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Barcha to‘lovlar</option><option value="CASH">Naqd</option><option value="CARD">Karta</option><option value="ELECTRONIC">Elektron</option><option value="DEBT">Nasiya</option></select></label>
      <button disabled={loading} className="flex items-center justify-center gap-2 self-end rounded bg-[#1e50b3] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Ko‘rsatish</button>
    </form>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Cheklar", `${report?.summary.salesCount || 0} ta`], ["Savdo", formatCurrency(report?.summary.gross || 0)], ["Qaytarish", formatCurrency(report?.summary.refunds || 0)], ["Sof tushum", formatCurrency(report?.summary.net || 0)], ["Sof foyda", formatCurrency(report?.summary.profit || 0)]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-xs font-semibold text-slate-500">{label}</span><strong className="mt-2 block text-xl text-[#1e50b3]">{value}</strong></div>)}</div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">To‘lov turlari</h2><div className="mt-4 space-y-3">{report?.methods.map((method) => <div key={method.method} className="flex justify-between border-b border-slate-100 pb-2 text-sm"><span>{getPaymentMethodLabel(method.method)} <small className="text-slate-500">({method.count} ta)</small></span><strong>{formatCurrency(method.amount - method.refunds)}</strong></div>)}</div></section>
      <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Kunlik savdo</h2>{report?.days.length ? <div className="mt-4 space-y-3">{report.days.map((day) => <div key={day.date} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 text-xs"><span>{day.date}</span><div className="h-3 rounded bg-slate-100"><div className="h-3 rounded bg-[#1e50b3]" style={{ width: `${Math.max(0, (day.sales - day.refunds) / maxDay * 100)}%` }} /></div><strong>{formatCurrency(day.sales - day.refunds)}</strong></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Bu davrda savdo yo‘q.</p>}</section>
    </div>
    <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Eng ko‘p sotilgan tovarlar</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Tovar</th><th className="p-3">Miqdor</th><th className="p-3">Summa</th></tr></thead><tbody>{report?.products.map((product) => <tr key={product.id} className="border-t"><td className="p-3">{product.name}</td><td className="p-3">{product.quantity} {product.unit}</td><td className="p-3 font-semibold">{formatCurrency(product.revenue)}</td></tr>)}</tbody></table>{!report?.products.length && <p className="p-3 text-sm text-slate-500">Tovar topilmadi.</p>}</div></section>
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-bold text-slate-900">Sotuvlar ro‘yxati</h2><p className="text-xs text-slate-500">Tanlangan davr bo‘yicha {report?.sales.length || 0} ta chek</p></div><div className="flex gap-2"><button type="button" onClick={download} disabled={!report} className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold"><Download size={16} /> CSV</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold"><Printer size={16} /> Chop etish</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Chek", "Sana", "Kassir", "Mijoz", "To‘lov", "Miqdor", "Summa"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{report?.sales.map((sale) => <tr key={sale.id} className="border-t border-slate-100"><td className="p-3 font-semibold text-[#1e50b3]">{sale.receiptNumber}</td><td className="p-3">{formatDateTime(sale.createdAt)}</td><td className="p-3">{sale.cashier}</td><td className="p-3">{sale.customer || "—"}</td><td className="p-3">{getPaymentMethodLabel(sale.paymentMethod)}</td><td className="p-3">{sale.itemsCount}</td><td className="p-3 font-bold">{formatCurrency(sale.payableAmount)}</td></tr>)}</tbody></table>{!loading && !report?.sales.length && <p className="p-5 text-sm text-slate-500">Bu davrda chek yo‘q.</p>}</div></section>
  </main>;
}
