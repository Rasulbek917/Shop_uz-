"use client";
import { useEffect, useRef, useState } from "react";
import { ScanBarcode, Boxes, Users, ArrowRight, Check } from "lucide-react";

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
  { title: "Jamoa va huquqlar", icon: Users, heading: "Har bir xodimga o‘z vazifasi.", text: "Premium tarifida kassir va omborchi uchun alohida hisoblar oching. Xodimlar roliga mos bo‘limlardan foydalanadi, do‘kon egasi esa umumiy jarayonni boshqaradi.", image: "dashboard-preview.webp", steps: ["Xodimga shaxsiy login ajratish", "Kassir yoki omborchi rolini belgilash", "Hisob holati va amallarni nazorat qilish"] },
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
 }} onClick={()=>setActive(i)}><w.icon size={19}/>{w.title}{i===2&&<small>PREMIUM</small>}</button>)}</div><div id="flow-panel" role="tabpanel" aria-labelledby={`flow-tab-${active}`} className="workflow-panel" key={active}><div><span className="eyebrow">0{active+1} / ISH JARAYONI</span><h3>{item.heading}</h3><p>{item.text}</p><ul>{item.steps.map(s=><li key={s}><Check size={17}/>{s}</li>)}</ul><a href="/register">Hisob yaratish <ArrowRight size={17}/></a></div><figure><img src={`/media/${item.image}`} alt={`${item.title} — namunaviy interfeys`} loading="lazy" width="1280" height="720"/><figcaption>Namunaviy ko‘rinish · Haqiqiy do‘kon ma’lumotlari emas</figcaption></figure></div></section>;
}
export function DemoPlayer() {
  const video = useRef<HTMLVideoElement>(null);
  const [chapters, setChapters] = useState<{title: string; start: number}[]>([]);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    fetch("/media/savdoza-tutorial.json?v=20261121")
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (mounted && Array.isArray(data?.chapters)) {
          setChapters(data.chapters.filter((chapter: {title?: unknown; start?: unknown}) => typeof chapter.title === "string" && typeof chapter.start === "number" && chapter.start >= 0));
        }
      }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  return <div className="usage-tutorial">
    <video ref={video} controls playsInline preload="metadata" width="1280" height="720" poster="/media/savdoza-tutorial-poster.webp?v=20261121" aria-label="Savdoza ishlatish bo‘yicha ovozli video qo‘llanma" onError={() => setFailed(true)} onPlay={() => setFailed(false)} onTimeUpdate={() => {
      const current = video.current?.currentTime || 0;
      setActive(chapters.reduce((selected, chapter, index) => chapter.start <= current ? index : selected, 0));
    }}>
      <source src="/media/savdoza-tutorial.mp4?v=20261121" type="video/mp4"/>
      <track kind="captions" src="/media/savdoza-tutorial.vtt?v=20261121" srcLang="uz" label="O‘zbekcha izohlar"/>
      <a href="/media/savdoza-tutorial.mp4">Video qo‘llanmani ochish</a>
    </video>
    {failed && <p role="alert">Video yuklanmadi. <a href="/media/savdoza-tutorial.mp4">Videoni alohida oching</a>.</p>}
    {!!chapters.length && <nav className="tutorial-chapters" aria-label="Video bosqichlari">{chapters.map((chapter,index) => <button key={chapter.start} type="button" aria-pressed={active === index} onClick={() => {
      if (video.current) {
        video.current.currentTime = chapter.start;
        void video.current.play().catch(() => {});
      }
    }}><small>{String(Math.floor(chapter.start / 60)).padStart(2,"0")}:{String(Math.floor(chapter.start % 60)).padStart(2,"0")}</small>{chapter.title}</button>)}</nav>}
  </div>;
}

export function PlanComparison() {
 return <div className="plan-compare"><h3>Farqini bir qarashda ko‘ring.</h3><div className="comparison-scroll"><table><caption className="sr-only">Standard va Premium imkoniyatlari</caption><thead><tr><th>Imkoniyat</th><th>Standard</th><th>Premium</th></tr></thead><tbody>{[["POS, naqd, karta va nasiya",true],["Ombor, partiyalar va mijozlar",true],["Hisobot va chek chop etish",true],["Kassir va omborchi hisoblari",false],["Yetkazib beruvchilar bazasi",false],["Amallar jurnali va markaziy import",false],["Cheklar CSV hisoboti va to‘lov tahlili",false]].map(([name,both])=><tr key={String(name)}><th scope="row">{name}</th><td>{both?"✓":"—"}</td><td>✓</td></tr>)}</tbody></table></div></div>;
}
