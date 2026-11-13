"use client";
import { useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
import Link from "next/link";
import { Check, ArrowUpRight, Layers, Sparkles } from "lucide-react";
import { PLAN_FEATURES } from "@/lib/plans";
export default function PublicPricing() {
  const [plans, setPlans] = useState<Array<{ code: string; price: number; enabled: boolean }>>([]);
  const [error, setError] = useState("");
  useEffect(() => { clientApi("/api/plans").then(setPlans).catch(e => setError(e.message)); }, []);
  if (error) return <p role="alert" className="form-error">{error}</p>;
  return <div className="price-grid">{(["PRO", "MAX"] as const).map(code => { const plan = plans.find(p => p.code === code); return <article className={code === "MAX" ? "price-card featured" : "price-card"} key={code}><div className="plan-emblem" aria-hidden="true">{code === "MAX" ? <Sparkles size={32}/> : <Layers size={32}/>}<i/><i/></div><div className="price-title"><h3>{code === "PRO" ? "Pro" : "Max"}</h3><span>{code === "PRO" ? "ASOSIY BOSHQARUV" : "JAMOA UCHUN"}</span></div><p>{code === "PRO" ? "Do‘konni o‘zingiz boshqarsangiz." : "Birgalikda ishlaydigan jamoangiz uchun."}</p><div className="price-value"><b>{plan ? plan.price.toLocaleString("uz-UZ") : "…"}</b><span> so‘m / 30 kun</span></div><Link className="public-button" href={`/register?plan=${code}`}>{code} bilan boshlash <ArrowUpRight size={18}/></Link><ul>{PLAN_FEATURES[code].map(f=><li key={f}><Check size={17}/>{f}</li>)}</ul></article>; })}</div>;
}
