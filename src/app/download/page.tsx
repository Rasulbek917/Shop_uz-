import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { Smartphone, Monitor, Download } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/marketing/PublicShell";

export const dynamic = "force-dynamic";
export default function DownloadsPage() {
  const versions = [
    { name: "Android", file: "savdoza-android.apk", icon: Smartphone, text: "Dashboard, mahsulotlar, POS va tarif boshqaruvi. HTTPS serveringiz va mavjud login orqali kiring." },
    { name: "Windows", file: "savdoza-windows.zip", icon: Monitor, text: "Windows uchun dastur. Arxivni to‘liq chiqaring va Savdoza.exe faylini oching." },
  ];
  return <div className="marketing"><PublicHeader/><main className="public-section"><span className="eyebrow">SAVDOZA ILOVALARI</span><h1 className="mb-6">Do‘koningiz yoningizda.</h1><p className="mb-10 max-w-2xl text-slate-500">Android va Windows uchun dasturlar mavjud Savdoza backendiga ulanadi. Server internet orqali ochiq va HTTPS bilan sozlangan bo‘lishi kerak. Ilovaga kirish uchun hisob va faol tarif talab qilinadi.</p><div className="price-grid">{versions.map(v => {
    const ready = existsSync(path.join(process.cwd(), "public", "releases", v.file));
    return <article className="price-card" key={v.name}><v.icon size={42}/><h2 className="my-6">{v.name}</h2><p>{v.text}</p>{ready ? <a href={`/releases/${v.file}`} download className="public-button mt-6"><Download size={18}/>Yuklab olish</a> : <p className="notice">Yuklab olish fayli hali e’lon qilinmagan.</p>}</article>;
  })}</div><p className="mt-8 text-sm text-slate-500">Windows dasturi uning DLL va data papkasi bilan birga tarqatiladi. Lokal kompyuterdagi localhost manzili telefondan serverga kirish uchun ishlamaydi.</p><Link href="/login" className="public-button secondary mt-8">Brauzer orqali kirish</Link></main><PublicFooter/></div>;
}
