import { Smartphone, Download } from "lucide-react";
import releases from "../../../public/releases/manifest.json";

export default function AppDownloads() {
  const android = releases.android as { url: string; version: string; sha256: string; bytes: number; channel: string } | null;
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
    <div className="flex items-center gap-4"><div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700"><Smartphone size={32}/></div><div><h2 className="text-2xl font-bold text-slate-900">Savdoza Android</h2><p className="text-sm text-slate-500">Telefon orqali do‘koningizni boshqaring</p></div></div>
    <p className="mt-6 text-slate-600">Alohida Android ilova. Dashboard, POS, mahsulotlar, kategoriyalar, ombor, mijozlar, qarzlar, QR cheklar, Pro/Max, xodimlar va sozlamalar. Birinchi kirish va katalogni yuklash uchun internet kerak.</p>
    {android ? <div className="mt-6 space-y-4"><a className="btn-primary" href={android.url}><Download size={18}/>APK yuklab olish</a><p className="text-xs text-slate-500">{android.version} · {(android.bytes / 1048576).toFixed(1)} MB · {["debug", "preview"].includes(android.channel) ? "Sinov versiyasi" : "Android"}</p><details className="text-xs text-slate-500"><summary>Faylni tekshirish uchun SHA-256</summary><code className="block break-all mt-2">{android.sha256}</code></details></div> : <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">APK yig‘ilmoqda. Fayl tayyorlangach yuklab olish tugmasi ochiladi.</p>}
    <ol className="list-decimal pl-5 mt-6 space-y-2 text-sm text-slate-600"><li>APK faylini telefoningizga yuklab oling va oching.</li><li>Android so‘rasa, ishlatayotgan brauzeringizga shu ilovani o‘rnatish ruxsatini bering.</li><li>Ilovada Savdoza login va parolingiz bilan kiring.</li></ol>
    <p className="mt-5 text-xs text-slate-500">Offline POS savdolari telefonda shifrlangan holda saqlanadi. Internet qaytganda Android avtomatik sinxronlaydi. Kamera skaneri, PNG chek saqlash va Android chop etish oynasi mavjud. Qoldiq yoki tarif xatosi chiqqan savdo tekshirish uchun navbatda saqlanadi.</p>
  </section>;
}
