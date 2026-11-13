"use client";
import { useEffect, useState } from "react";
import { clientApi, jsonOptions } from "@/lib/client-api";
import { PLAN_PRICES } from "@/lib/plans";

interface Method { provider_code: string; name: string; min_amount_minor: number; max_amount_minor: number; }
export default function OnlineCheckout({ planCode }: { planCode: "PRO" | "MAX" }) {
  const [methods, setMethods] = useState<Method[]>([]);
  const [providerCode, setProviderCode] = useState("");
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    clientApi("/api/checkout/methods").then(result => {
      if (active) { setMethods(result.methods); setConfigured(result.configured); }
    }).catch(e => { if (active) setError(e.message); });
    const saved = sessionStorage.getItem(`savdoza-checkout-${planCode}`);
    if (saved) setOrderId(saved);
    return () => { active = false; };
  }, [planCode]);
  useEffect(() => {
    if (!orderId) return;
    let active = true;
    let running = false;
    async function check() {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const result = await clientApi(`/api/checkout/${encodeURIComponent(orderId)}`);
        if (!active) return;
        setStatus(result.status);
        if (result.status === "PAID") {
          sessionStorage.removeItem(`savdoza-checkout-${planCode}`);
          window.location.replace("/admin");
        }
        if (result.status === "EXPIRED") sessionStorage.removeItem(`savdoza-checkout-${planCode}`);
      } catch (e) { if (active) setError((e as Error).message); }
      finally { running = false; }
    }
    check();
    const interval = setInterval(check, 10000);
    return () => { active = false; clearInterval(interval); };
  }, [orderId, planCode]);
  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !providerCode) return;
    setBusy(true); setError("");
    try {
      const result = await clientApi("/api/checkout", jsonOptions("POST", { planCode, providerCode }));
      sessionStorage.setItem(`savdoza-checkout-${planCode}`, result.id);
      setOrderId(result.id);
      window.location.assign(result.paymentUrl);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  const amount = PLAN_PRICES[planCode] * 100;
  const available = methods.filter(m => m.min_amount_minor <= amount && m.max_amount_minor >= amount);
  return <section className="purchase-form">
    <h2>{planCode} · {PLAN_PRICES[planCode].toLocaleString("uz-UZ")} so‘m / 30 kun</h2>
    <p>To‘lov usulini tanlang. Tezcheck to‘lov sahifasida to‘lovni yakunlang. Tasdiq kelgach hisobingiz avtomatik ochiladi.</p>
    {configured === false && <p className="notice">To‘lov xizmati hali sozlanmoqda. Administrator Tezcheck API tokenini ulashi kerak.</p>}
    {configured === null && !error && <p>To‘lov usullari yuklanmoqda…</p>}
    {configured && available.length === 0 && <p className="notice">Hozir bu tarif uchun to‘lov usuli ochilmagan.</p>}
    <form onSubmit={pay} className="public-form"><fieldset className="payment-methods" disabled={busy}><legend>To‘lov usuli</legend><div className="payment-method-grid">{available.map(method => <label key={method.provider_code} className={`payment-method ${providerCode === method.provider_code ? "chosen" : ""}`}><input type="radio" name="provider" value={method.provider_code} checked={providerCode === method.provider_code} onChange={() => setProviderCode(method.provider_code)} required/><span>{method.name}</span></label>)}</div></fieldset>
      {error && <p role="alert" className="form-error">{error}</p>}
      {orderId && status === "PENDING" && <p role="status" className="notice">To‘lov natijasi tekshirilmoqda.</p>}
      {status === "EXPIRED" && <p className="notice">To‘lov havolasi muddati tugagan. Yangi to‘lovni boshlashingiz mumkin.</p>}
      <button className="public-button" disabled={busy || !configured || !providerCode}>{busy ? "To‘lovga o‘tilmoqda…" : "To‘lovga o‘tish"}</button>
    </form>
  </section>;
}
