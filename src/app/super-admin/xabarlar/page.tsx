"use client";

import { useEffect, useState } from "react";
import { Inbox, RefreshCw, Check, X, Trash2, KeyRound } from "lucide-react";
import { clientApi, jsonOptions } from "@/lib/client-api";

type Decision = {
  kind: "registration" | "purchase" | "access" | "delete";
  id: string;
  approve?: boolean;
};

const date = (value: string) => new Date(value).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

export default function RequestsPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [days, setDays] = useState("30");
  const [plan, setPlan] = useState("PRO");

  async function load() {
    try {
      setData(await clientApi("/api/platform/requests"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  function open(next: Decision, planCode?: string) {
    setError("");
    setNote("");
    setDays("30");
    setPlan(planCode === "MAX" ? "MAX" : "PRO");
    setDecision(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !decision) return;
    setBusy(true);
    setError("");
    try {
      if (decision.kind === "delete") {
        await clientApi(`/api/shops/${decision.id}`, jsonOptions("DELETE", {}));
      } else {
        const body = decision.kind === "access"
          ? { ...decision, note, planCode: plan, durationDays: Number(days) }
          : { ...decision, note };
        await clientApi("/api/platform/requests", jsonOptions("PATCH", body));
      }
      setDecision(null);
      setNote("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function approvalButtons(kind: "registration" | "purchase", id: string) {
    return <div className="mt-4 flex flex-wrap gap-2">
      <button className="btn-primary" disabled={busy} onClick={() => open({ kind, id, approve: true })}><Check size={16}/>Tasdiqlash</button>
      <button className="btn-secondary" disabled={busy} onClick={() => open({ kind, id, approve: false })}><X size={16}/>Rad etish</button>
    </div>;
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Hisoblar va to‘lovlar</h1>
        <p className="mt-2 text-slate-500">Yangi hisoblar, administrator ruxsatlari va tasdiqlangan to‘lovlar.</p>
      </div>
      <button onClick={load} className="btn-secondary"><RefreshCw size={16}/>Yangilash</button>
    </div>
    {error && !decision && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {!data && !error && <p>Yuklanmoqda…</p>}
    {data && <>
      <section>
        <h2 className="mb-4 text-lg font-bold">Hisoblar va arizalar ({data.registrations.length})</h2>
        {data.registrations.length === 0 && <div className="flex gap-3 rounded-2xl border border-dashed bg-white p-8 text-slate-500"><Inbox/>Yangi hisoblar yo‘q.</div>}
        <div className="grid gap-4 lg:grid-cols-2">
          {data.registrations.map((shop: any) => <article key={shop.id} className="rounded-2xl border bg-white p-6">
            <h3 className="text-xl font-bold text-slate-900">{shop.name}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[["Ism", shop.adminName], ["Telefon", shop.phone], ["Login", shop.users[0]?.username], ["Email", shop.users[0]?.email]].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="break-all">{value}</dd></div>)}
            </dl>
            <small className="mt-3 block text-slate-500">Ro‘yxatdan o‘tgan {date(shop.createdAt)}</small>
            {shop.status === "AWAITING_PAYMENT" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">To‘lov kutilmoqda · {shop.subscriptionType}</p>}
            {shop.subscriptionEndDate && <p className="mt-3 text-sm text-slate-600">{shop.planCode} · Ruxsat muddati {date(shop.subscriptionEndDate)} gacha</p>}
            {shop.status === "PENDING" && approvalButtons("registration", shop.id)}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => open({ kind: "access", id: shop.id }, shop.planCode === "NONE" ? shop.subscriptionType : shop.planCode)}><KeyRound size={16}/>Ruxsat berish</button>
              <button className="btn-secondary text-red-700" disabled={busy} onClick={() => open({ kind: "delete", id: shop.id })}><Trash2 size={16}/>O‘chirish</button>
            </div>
          </article>)}
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-bold">To‘lovni tekshirish ({data.purchases.length})</h2>
        {data.purchases.length === 0 && <p className="rounded-2xl border border-dashed bg-white p-6 text-slate-500">Kutilayotgan to‘lovlar yo‘q.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {data.purchases.map((purchase: any) => <article key={purchase.id} className="rounded-2xl border bg-white p-6">
            <h3 className="text-xl font-bold">{purchase.shop.name} · {purchase.planCode}</h3>
            <p className="my-3 text-2xl font-bold">{purchase.amount.toLocaleString("uz-UZ")} so‘m</p>
            <p>{purchase.shop.adminName} · {purchase.shop.phone}</p>
            <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3">{purchase.reference}</p>
            <small className="text-slate-500">{date(purchase.createdAt)}</small>
            {approvalButtons("purchase", purchase.id)}
          </article>)}
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-bold">Tezcheck orqali to‘langan tariflar</h2>
        <p className="mb-4 text-sm text-slate-500">Oxirgi 100 ta tasdiqlangan to‘lov.</p>
        {(data.checkouts || []).length === 0 && <p className="rounded-2xl border border-dashed bg-white p-6 text-slate-500">Tasdiqlangan to‘lovlar hali yo‘q.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {(data.checkouts || []).map((payment: any) => <article key={payment.id} className="rounded-2xl border bg-white p-6">
            <h3 className="text-xl font-bold">{payment.shop.name}</h3>
            <p className="mt-2 text-emerald-700">To‘langan · {payment.planCode} · {payment.amount.toLocaleString("uz-UZ")} so‘m</p>
            <p className="mt-2 text-sm">{payment.shop.adminName} · {payment.shop.phone}</p>
            <small className="mt-3 block text-slate-500">{date(payment.paidAt)}</small>
          </article>)}
        </div>
      </section>
    </>}
    {decision && <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-7">
        <h2 id="review-title" className="text-xl font-bold">{decision.kind === "access" ? "Hisobga ruxsat berish" : decision.kind === "delete" ? "Hisobni o‘chirish" : decision.approve ? "Tasdiqlash" : "Rad etish"}</h2>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {decision.kind === "access" ? <>
          <p className="text-sm text-slate-500">Administrator ruxsati. Muddat bugundan hisoblanadi.</p>
          <label className="block text-sm font-medium">Tarif<select className="mt-2 w-full rounded-lg border p-3" value={plan} onChange={e => setPlan(e.target.value)}><option value="PRO">Pro</option><option value="MAX">Max</option></select></label>
          <label className="block text-sm font-medium">Necha kunga ruxsat berilsin<input className="mt-2 w-full rounded-lg border p-3" type="number" min={1} step={1} required value={days} onChange={e => setDays(e.target.value)}/></label>
        </> : decision.kind === "delete" ? <p className="text-sm text-slate-600">Hisobni o‘chirish foydalanuvchilarning tizimga kirishini to‘xtatadi. O‘chirishni tasdiqlang.</p> : <p className="text-sm text-slate-500">{decision.kind === "purchase" ? "Tasdiqlashdan oldin haqiqiy pul tushumini bank hisobingizdan tekshiring. Tasdiq tarifni faollashtiradi." : "Ariza tasdiqlangach, foydalanuvchi tarif sotib olishi mumkin."}</p>}
        {decision.kind !== "delete" && <label className="block text-sm font-medium">Izoh<textarea className="mt-2 w-full rounded-lg border p-3" maxLength={500} required={decision.approve === false} value={note} onChange={e => setNote(e.target.value)}/></label>}
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" disabled={busy}>{busy ? "Saqlanmoqda…" : decision.kind === "delete" ? "Hisobni o‘chirish" : "Qarorni saqlash"}</button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => setDecision(null)}>Bekor qilish</button>
        </div>
      </form>
    </div>}
  </div>;
}
