"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import ShiftPrint from "@/components/pos/ShiftPrint";

type Shift = { id: string; mine: boolean; status: string; openingCash: number; closingCash: number | null; notes: string | null; openedAt: string; closedAt: string | null; shop: { name: string }; cashier: { fullName: string }; cashMovements: Array<{ id: string; type: string; amount: number; note: string; createdAt: string }>; summary: { salesCount: number; amounts: { CASH: number; CARD: number; ELECTRONIC: number; DEBT: number }; refunds: number; cashIn: number; cashOut: number; expectedCash: number } };
const time = (value: string | null) => value ? new Date(value).toLocaleString("uz-UZ") : "—";

export default function ShiftPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [printShift, setPrintShift] = useState<Shift | null>(null);
  const load = useCallback(async () => { try { const response = await fetch("/api/shifts", { cache: "no-store" }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || "Smenalar yuklanmadi"); setShifts(result.data); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Smenalar yuklanmadi"); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const active = shifts.find((shift) => shift.status === "OPEN" && shift.mine);
  function print(shift: Shift) {
    setPrintShift(shift);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.classList.add("printing-shift");
      const cleanup = () => { document.body.classList.remove("printing-shift"); setPrintShift(null); };
      window.addEventListener("afterprint", cleanup, { once: true });
      window.print();
    }));
  }
  async function act(method: "POST" | "PATCH") {
    setBusy(true); setError("");
    try {
      const amount = Number(method === "POST" ? openingCash : closingCash);
      if (!Number.isFinite(amount) || amount < 0 || (method === "PATCH" && closingCash.trim() === "")) throw new Error("Naqd summani to‘g‘ri kiriting");
      const response = await fetch("/api/shifts", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(method === "POST" ? { openingCash: amount } : { shiftId: active?.id, closingCash: amount, notes: closingNotes.trim() }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Amal bajarilmadi");
      setClosingCash(""); setClosingNotes(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Amal bajarilmadi"); } finally { setBusy(false); }
  }
  async function addMovement() {
    setBusy(true); setError("");
    try {
      const amount = Number(movementAmount);
      if (!Number.isFinite(amount) || amount <= 0 || movementNote.trim().length < 2) throw new Error("Summa va izohni kiriting");
      const response = await fetch("/api/cash-movements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: movementType, amount, note: movementNote.trim() }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Kassa amali saqlanmadi");
      setMovementAmount(""); setMovementNote(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kassa amali saqlanmadi"); } finally { setBusy(false); }
  }
  return <main className="min-h-full bg-[#f3f5f9] pb-10">
    <div className="border-b border-slate-200 bg-white px-5 py-5 md:px-8"><Link href="/kassir" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1e50b3]"><ArrowLeft size={16} /> Kassa</Link><div className="mt-3 flex items-center justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Smenalar</h1><p className="text-sm text-slate-500">Kassa smenasini ochish, nazorat qilish va yopish</p></div><button onClick={() => void load()} className="rounded-md border border-slate-200 p-2 text-slate-600" aria-label="Yangilash"><RefreshCw size={18} /></button></div></div>
    <div className="space-y-5 p-5 md:p-8">{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-lg bg-[#e9f0ff] p-3 text-[#1e50b3]"><Wallet size={25} /></span><div><h2 className="font-bold text-slate-900">{active ? "Smena ochiq" : "Smena yopiq"}</h2><p className="text-sm text-slate-500">{active ? `${active.cashier.fullName} · ${time(active.openedAt)}` : "Savdoni boshlash uchun smena oching"}</p></div></div>
        {active ? <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4"><div><small className="text-slate-500">Cheklar</small><strong className="block text-xl">{active.summary.salesCount}</strong></div><div><small className="text-slate-500">Naqd tushum</small><strong className="block text-xl">{formatCurrency(active.summary.amounts.CASH)}</strong></div><div><small className="text-slate-500">Karta</small><strong className="block text-xl">{formatCurrency(active.summary.amounts.CARD)}</strong></div><div><small className="text-slate-500">Kutilgan naqd</small><strong className="block text-xl">{formatCurrency(active.summary.expectedCash)}</strong></div></div> : null}
        {active && <p className="mt-4 text-sm text-slate-600">Savdoni tugatgach kassadagi naqd pulni sanang. Tizim hisoblagan kutilgan summa: <strong>{formatCurrency(active.summary.expectedCash)}</strong>. Farq bo‘lsa izoh yozing.</p>}
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5"><label className="text-sm font-medium text-slate-700">{active ? "Kassadagi haqiqiy naqd" : "Boshlang‘ich naqd"}<input type="number" min="0" step="1" value={active ? closingCash : openingCash} onChange={(event) => active ? setClosingCash(event.target.value) : setOpeningCash(event.target.value)} className="mt-1 block w-56 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#1e50b3]" /></label>{active && <button type="button" onClick={() => setClosingCash(String(active.summary.expectedCash))} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700">Kutilgan summani qo‘yish</button>}{active && <label className="text-sm font-medium text-slate-700">Yopish izohi<input value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} maxLength={500} placeholder="Farq yoki topshirish izohi" className="mt-1 block w-64 rounded-md border border-slate-300 px-3 py-2" /></label>}<button disabled={busy || loading} onClick={() => void act(active ? "PATCH" : "POST")} className="rounded-md bg-[#1e50b3] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saqlanmoqda..." : active ? "Smenani yopish" : "Smenani ochish"}</button>{active && <Link href="/kassir" className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700">Savdoga qaytish</Link>}</div>
      </section>
      {active && <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Naqd tranzaksiyalar</h2><p className="text-sm text-slate-500">Kassaga naqd kiritish yoki xarajat uchun chiqarish</p></div><button type="button" onClick={() => print(active)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">K-hisobotni chop etish</button></div><div className="mt-4 grid gap-3 sm:grid-cols-[150px_150px_1fr_auto]"><select value={movementType} onChange={(event) => setMovementType(event.target.value as "IN" | "OUT")} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="IN">Kirim</option><option value="OUT">Chiqim</option></select><input type="number" min="1" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} placeholder="Summa" aria-label="Tranzaksiya summasi" className="rounded-md border border-slate-300 px-3 py-2 text-sm" /><input value={movementNote} onChange={(event) => setMovementNote(event.target.value)} placeholder="Izoh (masalan: inkassatsiya)" aria-label="Tranzaksiya izohi" className="rounded-md border border-slate-300 px-3 py-2 text-sm" /><button disabled={busy} onClick={() => void addMovement()} className="rounded-md bg-[#1e50b3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Saqlash</button></div><div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-sm"><span>Kirim: <b>{formatCurrency(active.summary.cashIn)}</b></span><span>Chiqim: <b>{formatCurrency(active.summary.cashOut)}</b></span><span>Qaytarilgan naqd: <b>{formatCurrency(active.summary.refunds)}</b></span></div>{active.cashMovements.length > 0 && <div className="mt-4 divide-y divide-slate-100">{active.cashMovements.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><b className={item.type === "IN" ? "text-blue-700" : "text-amber-700"}>{item.type === "IN" ? "Kirim" : "Chiqim"}</b> · {item.note}<small className="ml-2 text-slate-400">{time(item.createdAt)}</small></span><strong>{formatCurrency(item.amount)}</strong></div>)}</div>}</section>}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-bold text-slate-900">Smena tarixi</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Kassir", "Ochilgan", "Yopilgan", "Cheklar", "Naqd", "Karta", "Farq", "Holat"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{shifts.map((shift) => <tr key={shift.id} className="border-t border-slate-100 text-slate-700"><td className="px-4 py-3 font-medium"><button type="button" title={shift.status === "OPEN" ? "K-hisobotni chop etish" : "Z-hisobotni chop etish"} onClick={() => print(shift)} className="font-semibold text-[#1e50b3] underline">{shift.cashier.fullName} · {shift.status === "OPEN" ? "K" : "Z"}</button></td><td className="px-4 py-3">{time(shift.openedAt)}</td><td className="px-4 py-3">{time(shift.closedAt)}</td><td className="px-4 py-3">{shift.summary.salesCount}</td><td className="px-4 py-3">{formatCurrency(shift.summary.amounts.CASH)}</td><td className="px-4 py-3">{formatCurrency(shift.summary.amounts.CARD)}</td><td className="px-4 py-3">{shift.closingCash == null ? "—" : formatCurrency(shift.closingCash - shift.summary.expectedCash)}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-semibold ${shift.status === "OPEN" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{shift.status === "OPEN" ? "Ochiq" : "Yopiq"}</span></td></tr>)}</tbody></table>{!loading && shifts.length === 0 && <p className="p-5 text-sm text-slate-500">Hali smena ochilmagan.</p>}</div></section>
    </div>
    <ShiftPrint shift={printShift} shopName={printShift?.shop.name || "Savdoza"} />
  </main>;
}
