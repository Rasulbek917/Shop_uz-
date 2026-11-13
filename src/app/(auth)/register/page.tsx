"use client";
import { useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
import Link from "next/link";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { getErrorMessage } from "@/lib/errorMessage";
export default function RegisterPage() {
  const [busy,setBusy]=useState(false), [error,setError]=useState(""), [done,setDone]=useState(false);
  const [plans, setPlans] = useState<Array<{ code: string; price: number }>>([]);
  useEffect(() => { clientApi("/api/plans").then(setPlans).catch(() => {}); }, []);
  const [planCode, setPlanCode] = useState<"PRO" | "MAX">("PRO");
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("plan");
    if (selected === "MAX") setPlanCode("MAX");
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(busy) return; setBusy(true);setError("");
    const data = new FormData(e.currentTarget);
    const body = Object.fromEntries(data.entries());
    if(body.password !== body.confirmPassword) {setError("Parollar mos kelmadi");setBusy(false);return;}
    try { const res=await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,planCode,consent:data.get("consent")==="on"})}); const json=await res.json();if(!res.ok) throw new Error(getErrorMessage(json.error));setDone(true); window.location.assign(json.nextUrl); }
    catch(e) {setError(e instanceof Error?e.message:"Ulanishda xato");} finally {setBusy(false);}
  }
  return <div className="marketing auth-screen"><aside className="auth-story"><Link href="/" className="wordmark">savdoza®</Link><div><span className="eyebrow">DO‘KONINGIZGA XUSH KELIBSIZ</span><h1>Katta ishlar<br/>tartibdan<br/>boshlanadi.</h1><p>Bitta hisob. Bir joyda savdo, ombor va mijozlar.</p><img src="/media/pos-illustration.svg" alt="POS namunasi"/></div><span><ShieldCheck size={17}/> Hisob yarating va tanlangan tarif to‘loviga o‘ting</span></aside><main className="auth-form-area"><Link href="/" className="auth-back">← Bosh sahifa</Link>{done ? <div className="registration-done"><Check size={44}/><h1>Hisobingiz yaratildi!</h1><p>To‘lov sahifasiga yo‘naltirilmoqda.</p><Link className="public-button" href={`/checkout?plan=${planCode}`}>To‘lovga o‘tish <ArrowUpRight size={18}/></Link></div> : <><span className="eyebrow">BIRINCHI QADAM</span><h1>Hisob yarating</h1><p>Allaqachon hisobingiz bormi? <Link href="/login">Kirish</Link></p><form onSubmit={submit} className="public-form"><label>Tanlangan tarif<select value={planCode} onChange={e => setPlanCode(e.target.value as "PRO" | "MAX")} className="w-full rounded-xl border p-3 mt-2"><option value="PRO">Pro {plans.find(p => p.code === "PRO") ? "— " + plans.find(p => p.code === "PRO")!.price.toLocaleString("uz-UZ") + " so‘m / 30 kun" : ""}</option><option value="MAX">Max {plans.find(p => p.code === "MAX") ? "— " + plans.find(p => p.code === "MAX")!.price.toLocaleString("uz-UZ") + " so‘m / 30 kun" : ""}</option></select></label><div className="form-two">{[["fullName","Ism va familiya","text","Ismingiz","name"],["shopName","Do‘kon nomi","text","Do‘koningiz","organization"],["phone","Telefon raqami","tel","+998901234567","tel"],["email","Email","email","siz@example.uz","email"],["username","Login","text","dokon_egasi","username"],["password","Parol","password","Kamida 10 belgi, harf va raqam","new-password"]].map(([name,label,type,placeholder,autoComplete])=><label key={name}>{label}<input name={name} type={type} placeholder={placeholder} autoComplete={autoComplete} minLength={name==="password"?10:undefined} maxLength={name==="password"?72:254} required/></label>)}</div><label>Parolni takrorlang<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={72}/></label><label className="consent"><input name="consent" type="checkbox" required/><span><Link href="/terms">Foydalanish shartlari</Link> va <Link href="/privacy">maxfiylik qoidalari</Link> bilan tanishdim.</span></label>{error&&<p role="alert" className="form-error">{error}</p>}<button disabled={busy} className="public-button large">{busy?"Yuborilmoqda…":"Hisob yaratish va to‘lovga o‘tish"}<ArrowUpRight size={18}/></button><small>Ro‘yxatdan o‘tish bepul. Funksiyalar to‘lov tasdiqlangach ochiladi.</small></form></>}</main></div>;
}
