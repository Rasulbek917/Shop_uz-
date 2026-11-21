"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownToLine, ClipboardCheck, History, Package, Plus, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

type Product = { id: string; name: string; barcode?: string | null; salePrice: number; unit: string };
type Supplier = { id: string; name: string };
type Batch = { id: string; productId: string; batchNumber: string; currentQuantity: number; purchasePrice: number; salePrice: number; expiryDate: string; status: string; product: Product; supplier?: Supplier | null };
type Movement = { id: string; type: string; quantity: number; unitPrice: number; notes?: string | null; createdAt: string; product: Pick<Product, "name" | "unit">; batch?: { batchNumber: string } | null; createdBy?: { fullName: string } | null };
type Tab = "STOCK" | "INFLOW" | "COUNT" | "MOVEMENTS";
const tabs: Array<{ id: Tab; label: string; icon: typeof Package }> = [
  { id: "STOCK", label: "Qoldiqlar", icon: Package },
  { id: "INFLOW", label: "Tovar kirimi", icon: ArrowDownToLine },
  { id: "COUNT", label: "Inventarizatsiya", icon: ClipboardCheck },
  { id: "MOVEMENTS", label: "Harakat tarixi", icon: History },
];
const date = (value: string) => new Date(value).getUTCFullYear() >= 2099 ? "Muddatsiz" : new Date(value).toLocaleDateString("uz-UZ");
const datetime = (value: string) => new Date(value).toLocaleString("uz-UZ");
const emptyInflow = () => ({ productId: "", batchNumber: `KIRIM-${Date.now().toString(36).toUpperCase()}`, quantity: "", purchasePrice: "", salePrice: "", expiryDate: "", supplierId: "" });

export default function InventoryPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>("STOCK");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [countedQuantity, setCountedQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [inflow, setInflow] = useState(emptyInflow);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([fetch("/api/inventory/batches", { cache: "no-store" }), fetch("/api/products", { cache: "no-store" }), fetch("/api/inventory/movements", { cache: "no-store" }), fetch("/api/suppliers", { cache: "no-store" })]);
      const [batchResult, productResult, movementResult, supplierResult] = await Promise.all(responses.map((response) => response.json()));
      if (!batchResult.success || !productResult.success || !movementResult.success) throw new Error("Ombor ma’lumotlarini yuklab bo‘lmadi");
      setBatches(batchResult.data || []);
      setProducts(productResult.data || []);
      setMovements(movementResult.data || []);
      setSuppliers(supplierResult.success ? supplierResult.data || [] : []);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ombor ma’lumotlari yuklanmadi"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("tab") !== "inflow") return;
    setTab("INFLOW");
    const productId = query.get("productId");
    if (productId) setInflow((current) => ({ ...current, productId }));
  }, []);
  useEffect(() => {
    if (!inflow.productId || inflow.salePrice) return;
    const product = products.find((item) => item.id === inflow.productId);
    if (product) setInflow((current) => ({ ...current, salePrice: String(product.salePrice) }));
  }, [products, inflow.productId, inflow.salePrice]);

  const filtered = useMemo(() => batches.filter((batch) => {
    const query = search.trim().toLocaleLowerCase();
    return (status === "ALL" || batch.status === status) && (!query || [batch.product.name, batch.product.barcode || "", batch.batchNumber].some((value) => value.toLocaleLowerCase().includes(query)));
  }), [batches, search, status]);
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);
  const totalStock = batches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
  const stockValue = batches.reduce((sum, batch) => sum + batch.currentQuantity * batch.purchasePrice, 0);
  const expiring = batches.filter((batch) => batch.status !== "NORMAL" && batch.currentQuantity > 0).length;

  function startCount(batch: Batch) { setSelectedBatchId(batch.id); setCountedQuantity(String(batch.currentQuantity)); setReason(""); setTab("COUNT"); setMessage(""); }
  async function submitInflow(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/inventory/inflow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: inflow.productId, batchNumber: inflow.batchNumber.trim(), quantity: Number(inflow.quantity), purchasePrice: Number(inflow.purchasePrice), salePrice: Number(inflow.salePrice), expiryDate: inflow.expiryDate, supplierId: inflow.supplierId || null }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(typeof result.error === "string" ? result.error : result.error?.message || "Kirim saqlanmadi");
      setMessage(result.message || "Tovar kirimi saqlandi"); setInflow(emptyInflow()); await load(); setTab("STOCK");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kirim saqlanmadi"); } finally { setBusy(false); }
  }
  async function submitCount(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/inventory/adjustment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ batchId: selectedBatchId, countedQuantity: Number(countedQuantity), reason: reason.trim() }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Inventarizatsiya saqlanmadi");
      setMessage(`Qoldiq saqlandi: ${result.data.previousQuantity} → ${result.data.currentQuantity}`); await load(); setTab("STOCK");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Inventarizatsiya saqlanmadi"); } finally { setBusy(false); }
  }

  return <main className="space-y-5 rounded-lg bg-[#f3f5f9] p-1 pb-8">
    <header className="rounded-lg border border-slate-200 bg-white px-5 py-5"><p className="text-xs font-bold uppercase tracking-widest text-[#1e50b3]">Ombor boshqaruvi</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Tovarlar va qoldiqlar</h1><p className="mt-1 text-sm text-slate-500">Partiya kirimi, sanash va tovar harakati bir ekranda</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Yangilash</button></div></header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-xs text-slate-500">Jami qoldiq</span><strong className="mt-2 block text-xl">{totalStock.toLocaleString("uz-UZ")} dona</strong></div><div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-xs text-slate-500">Ombor qiymati</span><strong className="mt-2 block text-xl">{formatCurrency(stockValue)}</strong></div><div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-xs text-slate-500">Muddati yaqin yoki o‘tgan</span><strong className="mt-2 flex items-center gap-2 text-xl"><TriangleAlert size={18} className="text-amber-600" /> {expiring} partiya</strong></div></div>
    <nav className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2" aria-label="Ombor bo‘limlari">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setTab(id); setError(""); }} className={`flex shrink-0 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold ${tab === id ? "bg-[#1e50b3] text-white" : "text-slate-600 hover:bg-slate-100"}`}><Icon size={17} /> {label}</button>)}</nav>

    {tab === "STOCK" && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="flex flex-wrap gap-3 border-b border-slate-200 p-4"><label className="relative min-w-60 flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input aria-label="Qoldiqni qidirish" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mahsulot, shtrix-kod yoki partiya" className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm" /></label><select aria-label="Muddat holati" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="ALL">Barcha partiyalar</option><option value="NORMAL">Yaroqli</option><option value="APPROACHING">Muddati yaqin</option><option value="EXPIRED">Muddati o‘tgan</option></select><button onClick={() => setTab("INFLOW")} className="inline-flex items-center gap-2 rounded-md bg-[#1e50b3] px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> Kirim qilish</button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Mahsulot", "Partiya", "Qoldiq", "Kelish narxi", "Sotuv narxi", "Muddat", "Yetkazib beruvchi", "Amal"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{filtered.map((batch) => <tr key={batch.id} className="border-t border-slate-100"><td className="px-4 py-3"><strong>{batch.product.name}</strong><small className="block text-slate-500">{batch.product.barcode || "Kodsiz"}</small></td><td className="px-4 py-3">{batch.batchNumber}</td><td className="px-4 py-3 font-semibold">{batch.currentQuantity} {batch.product.unit}</td><td className="px-4 py-3">{formatCurrency(batch.purchasePrice)}</td><td className="px-4 py-3">{formatCurrency(batch.salePrice)}</td><td className="px-4 py-3"><span className={batch.status === "EXPIRED" ? "text-red-700" : batch.status === "APPROACHING" ? "text-amber-700" : "text-slate-700"}>{date(batch.expiryDate)}</span></td><td className="px-4 py-3">{batch.supplier?.name || "—"}</td><td className="px-4 py-3"><button type="button" onClick={() => startCount(batch)} className="rounded border border-blue-200 px-3 py-1.5 font-semibold text-blue-700">Sanash</button></td></tr>)}</tbody></table>{!loading && filtered.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Partiya topilmadi. Tovar kirimi orqali qo‘shing.</p>}</div></section>}

    {tab === "INFLOW" && <section className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Tovar kirimi</h2><p className="text-sm text-slate-500">Yangi partiya va kelish narxini yozing</p></div><Link href={pathname.startsWith("/omborchi") ? "/omborchi/mahsulotlar?new=1" : "/admin/mahsulotlar?new=1"} className="text-sm font-semibold text-[#1e50b3]">Yangi tovar yaratish</Link></div><form onSubmit={submitInflow} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-medium text-slate-700">Mahsulot<select required value={inflow.productId} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); setInflow((current) => ({ ...current, productId: event.target.value, salePrice: product ? String(product.salePrice) : "" })); }} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"><option value="">Tanlang</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Partiya raqami<input required value={inflow.batchNumber} onChange={(event) => setInflow((current) => ({ ...current, batchNumber: event.target.value }))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Miqdor<input required type="number" min="1" step="1" value={inflow.quantity} onChange={(event) => setInflow((current) => ({ ...current, quantity: event.target.value }))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Kelish narxi<input required type="number" min="0" step="any" value={inflow.purchasePrice} onChange={(event) => setInflow((current) => ({ ...current, purchasePrice: event.target.value }))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Sotuv narxi<input required type="number" min="0" step="any" value={inflow.salePrice} onChange={(event) => setInflow((current) => ({ ...current, salePrice: event.target.value }))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Yaroqlilik sanasi<input type="date" value={inflow.expiryDate} onChange={(event) => setInflow((current) => ({ ...current, expiryDate: event.target.value }))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /><small className="mt-1 block text-slate-500">Muddatsiz bo‘lsa, bo‘sh qoldiring.</small></label><label className="text-sm font-medium text-slate-700">Yetkazib beruvchi<select value={inflow.supplierId} onChange={(event) => setInflow((current) => ({ ...current, supplierId: event.target.value }))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"><option value="">Ko‘rsatilmagan</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><div className="flex items-end"><button disabled={busy} className="w-full rounded-md bg-[#1e50b3] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saqlanmoqda..." : "Kirimni saqlash"}</button></div></form></section>}

    {tab === "COUNT" && <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">Inventarizatsiya</h2><p className="mt-1 text-sm text-slate-500">Amaldagi qoldiqni sanab, farq sababini yozing</p><form onSubmit={submitCount} className="mt-5 grid max-w-3xl gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700 sm:col-span-2">Partiya<select required value={selectedBatchId} onChange={(event) => { const batch = batches.find((item) => item.id === event.target.value); setSelectedBatchId(event.target.value); setCountedQuantity(batch ? String(batch.currentQuantity) : ""); }} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"><option value="">Tanlang</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.product.name} · #{batch.batchNumber} · {batch.currentQuantity} {batch.product.unit}</option>)}</select></label><div className="rounded-md bg-slate-50 p-3 text-sm"><span className="text-slate-500">Tizimdagi qoldiq</span><strong className="mt-1 block text-lg">{selectedBatch ? `${selectedBatch.currentQuantity} ${selectedBatch.product.unit}` : "—"}</strong></div><label className="text-sm font-medium text-slate-700">Sanab chiqilgan miqdor<input required type="number" min="0" step="1" value={countedQuantity} onChange={(event) => setCountedQuantity(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label><div className="rounded-md bg-blue-50 p-3 text-sm"><span className="text-blue-700">Farq</span><strong className="mt-1 block text-lg text-blue-900">{selectedBatch && countedQuantity !== "" ? Number(countedQuantity) - selectedBatch.currentQuantity : "—"}</strong></div><label className="text-sm font-medium text-slate-700">Farq sababi<input required minLength={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Masalan: qayta sanash" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label><button disabled={busy || !selectedBatch} className="rounded-md bg-[#1e50b3] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Saqlanmoqda..." : "Qoldiqni tasdiqlash"}</button></form></section>}

    {tab === "MOVEMENTS" && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="border-b border-slate-200 p-4"><h2 className="text-lg font-bold text-slate-900">Tovar harakati</h2><p className="text-sm text-slate-500">Kirim, sotuv, qaytarish va inventarizatsiya yozuvlari</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Vaqt", "Tovar", "Partiya", "Amal", "Miqdor", "Xodim", "Izoh"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{movements.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3">{datetime(item.createdAt)}</td><td className="px-4 py-3 font-semibold">{item.product.name}</td><td className="px-4 py-3">{item.batch?.batchNumber || "—"}</td><td className="px-4 py-3">{{ INFLOW: "Kirim", OUTFLOW_SALE: "Sotuv", OUTFLOW_RETURN: "Qaytarish", ADJUSTMENT: "Inventarizatsiya" }[item.type] || item.type}</td><td className="px-4 py-3 font-semibold">{item.quantity > 0 ? "+" : ""}{item.quantity} {item.product.unit}</td><td className="px-4 py-3">{item.createdBy?.fullName || "—"}</td><td className="px-4 py-3 text-slate-500">{item.notes || "—"}</td></tr>)}</tbody></table>{movements.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Hali harakat yozuvi yo‘q.</p>}</div></section>}
  </main>;
}
