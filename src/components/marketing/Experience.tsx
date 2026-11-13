"use client";
import { useEffect, useRef, useState } from "react";
import { ScanBarcode, Boxes, Users, ArrowRight, Check, Play } from "lucide-react";

export function ScrollMotion() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("revealed"); observer.unobserve(e.target); }
    }), { threshold: .08 });
    const elements = document.querySelectorAll(".marketing main > section:not(.public-hero), .feature-grid article, .price-card");
    elements.forEach(el => { el.classList.add("reveal-ready"); observer.observe(el); });
    return () => { observer.disconnect(); elements.forEach(el => el.classList.remove("reveal-ready")); };
  }, []);
  return null;
}
const workflows = [
  { title: "Kassa va savdo", icon: ScanBarcode, heading: "Skanerdan chekkacha — bir oqim.", text: "Mahsulotni kod yoki nom orqali toping. Miqdorni belgilang, mijozni tanlang va naqd yoki karta to‘lovini qayd eting. Nasiya savdolari qarzlar bo‘limida ko‘rinadi.", image: "pos-preview.webp", steps: ["Mahsulotni qidirish va savatga qo‘shish", "To‘lovni qayd etish va qoldiqni yangilash", "Chekni ko‘rish va chop etish"] },
  { title: "Ombor va hisob", icon: Boxes, heading: "Mahsulot yo‘lini kuzatib boring.", text: "Kirimni partiyalar bo‘yicha yuriting. Xarid narxi, sotuv narxi va yaroqlilik muddatini saqlang. Qoldiqni tekshirib, keyingi xaridni rejalashtiring.", image: "dashboard-preview.webp", steps: ["Mahsulot kartasi va partiya yaratish", "Kirim, sotuv va qaytarishni kuzatish", "Kam qolgan mahsulotlarni aniqlash"] },
  { title: "Jamoa va huquqlar", icon: Users, heading: "Har bir xodimga o‘z vazifasi.", text: "Max tarifida kassir va omborchi uchun alohida hisoblar oching. Xodimlar roliga mos bo‘limlardan foydalanadi, do‘kon egasi esa umumiy jarayonni boshqaradi.", image: "dashboard-preview.webp", steps: ["Xodimga shaxsiy login ajratish", "Kassir yoki omborchi rolini belgilash", "Hisob holati va amallarni nazorat qilish"] },
];
export function WorkflowExplorer() {
 const [active,setActive]=useState(0); const item=workflows[active];
 return <section className="public-section workflow-section"><div className="section-heading"><div><span className="eyebrow">BIR PLATFORMADA</span><h2>Bir kunlik ishni<br/>bir joydan boshqaring.</h2></div><p>Bo‘limni tanlang va Savdoza do‘koningizdagi kundalik vazifalarni qanday birlashtirishini ko‘ring.</p></div><div className="workflow-tabs" role="tablist" aria-label="Ish jarayonlari">{workflows.map((w,i)=><button key={w.title} id={`flow-tab-${i}`} role="tab" aria-selected={i===active} tabIndex={i===active?0:-1} aria-controls="flow-panel" onKeyDown={event=>{
   const keys=["ArrowRight","ArrowLeft","Home","End"];
   if(!keys.includes(event.key)) return;
   event.preventDefault();
   const next=event.key==="Home"?0:event.key==="End"?workflows.length-1:(i+(event.key==="ArrowRight"?1:workflows.length-1))%workflows.length;
   setActive(next);
   document.getElementById(`flow-tab-${next}`)?.focus();
 }} onClick={()=>setActive(i)}><w.icon size={19}/>{w.title}{i===2&&<small>MAX</small>}</button>)}</div><div id="flow-panel" role="tabpanel" aria-labelledby={`flow-tab-${active}`} className="workflow-panel" key={active}><div><span className="eyebrow">0{active+1} / ISH JARAYONI</span><h3>{item.heading}</h3><p>{item.text}</p><ul>{item.steps.map(s=><li key={s}><Check size={17}/>{s}</li>)}</ul><a href="/register">Hisob yaratish <ArrowRight size={17}/></a></div><figure><img src={`/media/${item.image}`} alt={`${item.title} — namunaviy interfeys`} loading="lazy" width="1280" height="720"/><figcaption>Namunaviy ko‘rinish · Haqiqiy do‘kon ma’lumotlari emas</figcaption></figure></div></section>;
}
export function DemoPlayer() {
 const ref=useRef<HTMLVideoElement>(null);const [chapter,setChapter]=useState(0);
 const chapters=["Hisob ochish","Mahsulot tanlash","To‘lov va chek","Dashboard"];
 return <div className="demo-player"><video ref={ref} controls playsInline preload="metadata" poster="/media/demo-poster.webp" onTimeUpdate={()=>setChapter(Math.min(3,Math.floor((ref.current?.currentTime||0)/6)))} aria-label="Savdoza namoyish videosi"><source src="/media/savdoza-demo.webm" type="video/webm"/><track kind="captions" src="/media/demo-captions.vtt" srcLang="uz" label="O‘zbekcha" default/></video><div className="demo-chapters">{chapters.map((name,i)=><button key={name} className={chapter===i?"selected":""} aria-label={`${name}, ${i*6}-soniyadan ko‘rish`} onClick={()=>{if(ref.current){ref.current.currentTime=i*6;void ref.current.play().catch(()=>{});}}}><Play size={12}/><span><small>00:{String(i*6).padStart(2,"0")}</small>{name}</span></button>)}</div></div>;
}
export function PlanComparison() {
 return <div className="plan-compare"><h3>Farqini bir qarashda ko‘ring.</h3><div className="comparison-scroll"><table><caption className="sr-only">Pro va Max imkoniyatlari</caption><thead><tr><th>Imkoniyat</th><th>Pro</th><th>Max</th></tr></thead><tbody>{[["POS, naqd, karta va nasiya",true],["Ombor, partiyalar va mijozlar",true],["Hisobot va chek chop etish",true],["Kassir va omborchi hisoblari",false],["Yetkazib beruvchilar bazasi",false],["Amallar jurnali va markaziy import",false],["Cheklar CSV hisoboti va to‘lov tahlili",false]].map(([name,both])=><tr key={String(name)}><th scope="row">{name}</th><td>{both?"✓":"—"}</td><td>✓</td></tr>)}</tbody></table></div></div>;
}
