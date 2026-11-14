"use client";
import { useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
export default function PosGatewaySettings() {
    const [info, setInfo] = useState<any>(null);
    const [form, setForm] = useState({ cashDeskCode: "", token: "", webhookSecret: "" });
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    async function load() {
        try {
            const result = await clientApi("/api/shop/pos-gateway");
            setInfo(result);
            setForm(old => ({ ...old, cashDeskCode: result.cashDeskCode }));
        }
        catch (error) {
            setMessage((error as Error).message);
        }
    }
    useEffect(() => { void load(); }, []);
    async function save(event: React.FormEvent) {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
            await clientApi("/api/shop/pos-gateway", { method: "PUT", body: JSON.stringify(form) });
            setForm(old => ({ ...old, token: "", webhookSecret: "" }));
            await load();
            setMessage("Kassa ulandi. Tezcheck kabinetiga quyidagi webhook manzilini kiriting.");
        }
        catch (error) {
            setMessage((error as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="card max-w-2xl space-y-5">
    <h1 className="text-2xl font-bold">POS elektron to‘lovlari</h1>
    <p>Do‘koningizning Tezcheck kassasini ulang. Xaridor to‘lovi shu kassaga tushadi.</p>
    {info && <p className="font-semibold">{info.configured ? "Kassa ulangan" : "Kassa ulanmagan"}</p>}
    <form onSubmit={save} className="space-y-4">
      <label className="block">Kassa kodi<input className="input mt-1 w-full" required autoComplete="off" value={form.cashDeskCode} onChange={e => setForm({ ...form, cashDeskCode: e.target.value })}/></label>
      <label className="block">Tezcheck API tokeni<input className="input mt-1 w-full" required type="password" autoComplete="new-password" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })}/></label>
      <label className="block">Webhook maxfiy kaliti<input className="input mt-1 w-full" required type="password" autoComplete="new-password" value={form.webhookSecret} onChange={e => setForm({ ...form, webhookSecret: e.target.value })}/></label>
      <button className="btn-primary" disabled={busy}>{busy ? "Tekshirilmoqda…" : "Kassani tekshirish va saqlash"}</button>
    </form>
    {info?.webhookUrl && <div className="rounded-xl border p-4 space-y-3"><p>Tezcheck kassasida webhook manzilini qo‘shing</p><code className="block break-all text-sm">{info.webhookUrl}</code><button className="btn-secondary" onClick={() => navigator.clipboard.writeText(info.webhookUrl).then(() => setMessage("Webhook manzili nusxalandi"))}>Manzilni nusxalash</button></div>}
    <p className="text-sm text-slate-600">Kassada asosiy to‘lov havolasi va kerakli to‘lov usullarini yoqing. Karta ma’lumotlari to‘lov xizmatining sahifasida kiritiladi.</p>
    {message && <p role="status" className="rounded-xl bg-slate-100 p-4">{message}</p>}
  </section>;
}
