import Link from "next/link";
import { ArrowLeft, ArrowUpRight, type LucideIcon } from "lucide-react";

export type ModuleTile = { label: string; href: string; icon: LucideIcon; description?: string };

export default function ModuleHub({ title, subtitle, tiles }: { title: string; subtitle: string; tiles: ModuleTile[] }) {
  return <main className="min-h-full bg-[#f3f5f9] pb-10">
    <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-8">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1d4ed8] hover:underline"><ArrowLeft size={16} /> Bosh sahifa</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><span className="rounded-md bg-[#e9f0ff] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#1745a8]">Boshqaruv menyusi</span></div>
    </div>
    <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:p-8">
      {tiles.map(({ label, href, icon: Icon, description }) => <Link key={href} href={href} className="group flex min-h-36 flex-col justify-between rounded-lg border border-[#1848aa] bg-[#1e50b3] p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#123d99] hover:shadow-lg">
        <div className="flex items-start justify-between"><Icon size={30} strokeWidth={1.75} /><ArrowUpRight size={18} className="opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div>
        <div><h2 className="mt-5 text-lg font-semibold leading-tight">{label}</h2>{description && <p className="mt-1 text-xs text-blue-100">{description}</p>}</div>
      </Link>)}
    </div>
  </main>;
}
