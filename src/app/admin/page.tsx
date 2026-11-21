"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Boxes, CreditCard, Settings, ShoppingBasket, UserCog, Users, Warehouse } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const modules = [
  { label: "Kassa", href: "/admin/pos", icon: ShoppingBasket, detail: "Savdo va to‘lov" },
  { label: "Hisobotlar", href: "/admin/hisobotlar", icon: BarChart3, detail: "Sotuv, cheklar va smena", key: "reports" },
  { label: "Tovarlar", href: "/admin/tovarlar", icon: Boxes, detail: "Mahsulot va narxlar", key: "products" },
  { label: "Ombor", href: "/admin/ombor", icon: Warehouse, detail: "Qoldiq va partiyalar", key: "inventory" },
  { label: "Moliya", href: "/admin/moliya", icon: CreditCard, detail: "Tushum va qarzlar", key: "finance" },
  { label: "Xodimlar", href: "/admin/xodimlar", icon: UserCog, detail: "Xodim va rollar", key: "staff" },
  { label: "Mijozlar", href: "/admin/mijozlar", icon: Users, detail: "Mijozlar va ballar", key: "customers" },
  { label: "Sozlamalar", href: "/sozlamalar", icon: Settings, detail: "Do‘kon va ilovalar" },
];

type Summary = { today?: { revenue?: number; salesCount?: number; profit?: number }; inventory?: { lowStockCount?: number } };

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<Summary>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  useEffect(() => { fetch("/api/reports", { cache: "no-store" }).then((r) => r.json()).then((r) => { if (r.success) setSummary(r.data); }).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((r) => { if (r.success) setVisibility(r.user.menuVisibility || {}); }).catch(() => {}); const onChange = (event: Event) => setVisibility((event as CustomEvent<Record<string, boolean>>).detail); window.addEventListener("menu-visibility-changed", onChange); return () => window.removeEventListener("menu-visibility-changed", onChange); }, []);
  return <main className="min-h-full bg-[#f3f5f9] pb-10">
    <div className="border-b border-slate-200 bg-white px-5 py-5 md:px-8"><p className="text-xs font-bold uppercase tracking-[.17em] text-[#1e50b3]">Savdoza POS</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Boshqaruv menyusi</h1><p className="mt-1 text-sm text-slate-500">Do‘koningizni kerakli bo‘limdan boshqaring</p></div>
    <section className="grid gap-3 px-5 pt-6 sm:grid-cols-2 lg:grid-cols-4 md:px-8">
      {[
        ["Bugungi tushum", formatCurrency(summary.today?.revenue || 0)],
        ["Cheklar", `${summary.today?.salesCount || 0} ta`],
        ["Sof foyda", formatCurrency(summary.today?.profit || 0)],
        ["Kam qolgan tovar", `${summary.inventory?.lowStockCount || 0} ta`],
      ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{label}</p><strong className="mt-2 block text-xl text-slate-900">{value}</strong></div>)}
    </section>
    <section className="px-5 pt-8 md:px-8"><h2 className="mb-4 text-lg font-bold text-slate-900">Asosiy bo‘limlar</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {modules.filter((module) => !("key" in module) || visibility[module.key!] !== false).map(({ label, href, icon: Icon, detail }) => <Link key={href} href={href} className="group flex min-h-40 flex-col justify-between rounded-lg border border-[#1848aa] bg-[#1e50b3] p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#123d99] hover:shadow-lg"><div className="flex justify-between"><Icon size={31} strokeWidth={1.7} /><ArrowUpRight size={18} className="opacity-70" /></div><div><h3 className="text-lg font-semibold">{label}</h3><p className="mt-1 text-xs text-blue-100">{detail}</p></div></Link>)}
    </div></section>
  </main>;
}
