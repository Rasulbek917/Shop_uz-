"use client";
import Link from "next/link";
import { Check, ArrowUpRight, Layers, Sparkles } from "lucide-react";
import { PLAN_PRICES, PLAN_FEATURES } from "@/lib/plans";
export default function PublicPricing() {
  return <div className="price-grid">{(["PRO", "MAX"] as const).map(code => { return <article className={code === "MAX" ? "price-card featured" : "price-card"} key={code}><div className="plan-emblem" aria-hidden="true">{code === "MAX" ? <Sparkles size={32}/> : <Layers size={32}/>}<i/><i/></div><div className="price-title"><h3>{code === "PRO" ? "Pro" : "Max"}</h3><span>{code === "PRO" ? "ASOSIY BOSHQARUV" : "JAMOA UCHUN"}</span></div><p>{code === "PRO" ? "Do‘konni o‘zingiz boshqarsangiz." : "Birgalikda ishlaydigan jamoangiz uchun."}</p><div className="price-value"><b>{PLAN_PRICES[code].toLocaleString("uz-UZ")}</b><span> so‘m / 30 kun</span></div><Link className="public-button" href={`/register?plan=${code}`}>{code} bilan boshlash <ArrowUpRight size={18}/></Link><ul>{PLAN_FEATURES[code].map(f=><li key={f}><Check size={17}/>{f}</li>)}</ul></article>; })}</div>;
}
