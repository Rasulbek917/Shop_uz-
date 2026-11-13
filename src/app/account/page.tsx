"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import OnlineCheckout from "@/components/marketing/OnlineCheckout";
import { Check, RefreshCw, ArrowUpRight, Clock3 } from "lucide-react";
import { clientApi, jsonOptions } from "@/lib/client-api";
import { PLAN_FEATURES } from "@/lib/plans";
import { PublicHeader, PublicFooter } from "@/components/marketing/PublicShell";
export default function AccountPage(){
 const waitingForAccess = useRef(false);
 const [data,setData]=useState<any>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[selected,setSelected]=useState<string|null>(null),[reference,setReference]=useState("");
 async function load(){try{const result = await clientApi("/api/account");
 if (waitingForAccess.current && result.user.hasAccess && window.location.pathname === "/checkout") {
   window.location.replace("/admin"); return;
 }
 if (!result.user.hasAccess) waitingForAccess.current = true;
 setData(result);setError("");}catch(e){setError((e as Error).message);}}
 useEffect(()=>{
 const plan = new URLSearchParams(window.location.search).get("plan");
 if (plan === "PRO" || plan === "MAX") setSelected(plan);
 load();const id=setInterval(load,window.location.pathname === "/checkout" ? 5000 : 30000);return()=>clearInterval(id);},[]);

 const shop=data?.shop;const pending=shop?.purchaseRequests?.some((p:any)=>p.status==="PENDING");
 const canBuy=shop&&["AWAITING_PAYMENT","ACTIVE","TRIAL","EXPIRED"].includes(shop.status);
 const messages:Record<string,string>={PENDING:"Arizangiz superadmin tomonidan ko‘rib chiqilmoqda.",AWAITING_PAYMENT:"Hisobingiz yaratildi. Tanlangan tarif uchun to‘lovni yakunlang.",REJECTED:"Arizangiz rad etildi.",BLOCKED:"Hisobingiz bloklangan. Administrator bilan bog‘laning.",EXPIRED:"Tarifni yangilang. Obuna muddati tugagan, ish bo‘limlari vaqtincha yopilgan.",ACTIVE:data?.user?.hasAccess?"Do‘koningiz ishlashga tayyor.":"Tarif muddati tugagan yoki rolingiz uchun Max tarifi kerak.",TRIAL:"Sinov hisobingiz faol."};
 return <div className="marketing"><PublicHeader username={data?.user?.username} plan={selected || shop?.planCode}/><main className="public-section account-main"><div className="account-heading"><div><span className="eyebrow">SHAXSIY HISOB</span><h1>{shop?.name||"Hisob va tarif"}</h1></div><div className="flex gap-3"><button className="public-button secondary" onClick={load}><RefreshCw size={16}/> Yangilash</button><button className="public-button secondary" onClick={async()=>{try{await clientApi("/api/auth/logout",{method:"POST"});window.location.assign("/login");}catch(e){setError((e as Error).message);}}}>Chiqish</button></div></div>{error&&<p role="alert" className="form-error">{error}</p>}{!data&&!error&&<p>Yuklanmoqda…</p>}{data&&<><div className="account-status"><Clock3/><div><h2>{data.user.fullName}</h2><p>{shop?messages[shop.status]:"Sizning hisobingizga do‘kon biriktirilmagan."}</p>{shop?.approvalNote&&<p>{shop.approvalNote}</p>}{shop?.subscriptionEndDate&&<small>Tarif: {shop.planCode} · {new Date(shop.subscriptionEndDate).toLocaleDateString("uz-UZ")} gacha</small>}</div>{data.user.hasAccess&&<Link className="public-button" href={data.user.role==="SUPER_ADMIN"?"/super-admin":data.user.role==="SHOP_ADMIN"?"/admin":data.user.role==="CASHIER"?"/kassir":"/omborchi"}>Boshqaruvga o‘tish <ArrowUpRight size={18}/></Link>}</div>{pending&&<p className="notice">To‘lov so‘rovingiz yuborildi. Superadmin tushumni tekshirguncha kuting.</p>}{data.user.role==="SHOP_ADMIN"&&<><div className="price-grid">{(["PRO","MAX"] as const).map(code=>{const p=data.plans.find((x:any)=>x.code===code);return <article className={code==="MAX"?"price-card featured":"price-card"} key={code}><div className="price-title"><h3>{code}</h3><span>30 KUN</span></div><div className="price-value"><b>{p ? p.price.toLocaleString("uz-UZ")+" so‘m" : "Narx yuklanmoqda…"}</b></div><ul>{PLAN_FEATURES[code].map(f=><li key={f}><Check size={17}/>{f}</li>)}</ul><button className="public-button" disabled={!canBuy || !p?.enabled} onClick={()=>{setSelected(code);setError("");}}>Tarifni sotib olish</button></article>})}</div><p className="pricing-note">Bir xil tarif uzaytirilganda qolgan kunlar saqlanadi. Boshqa tarif tanlansa, tasdiqlangan kundan yangi 30 kun boshlanadi.</p></>}{(selected === "PRO" || selected === "MAX") && canBuy && <OnlineCheckout key={selected} planCode={selected} username={data.user.username} price={data.plans.find((p:any)=>p.code===selected)?.price ?? 0} enabled={data.plans.find((p:any)=>p.code===selected)?.enabled === true}/>}{shop?.purchaseRequests?.length>0&&<section className="purchase-history"><h2>Xarid so‘rovlari</h2>{shop.purchaseRequests.map((p:any)=><article key={p.id}><div><b>{p.planCode} · {p.amount.toLocaleString("uz-UZ")} so‘m</b><p>{new Date(p.createdAt).toLocaleString("uz-UZ")}</p><small>{p.reviewNote}</small></div><span>{p.status==="PENDING"?"Tekshirilmoqda":p.status==="APPROVED"?"Tasdiqlangan":"Rad etilgan"}</span></article>)}</section>}</>}</main><PublicFooter/></div>;
}
