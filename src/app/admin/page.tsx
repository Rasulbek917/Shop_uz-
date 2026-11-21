"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Boxes, CreditCard, Settings, ShoppingBasket, UserCog, Users, Warehouse } from "lucide-react";
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
  return <main className="min-h-full pb-8">
    <div className="border-b border-slate-200 bg-white px-4 py-4 md:px-6"><h1 className="text-xl font-semibold text-slate-900">Boshqaruv paneli</h1><p className="mt-1 text-sm text-slate-500">Do‘konning bugungi holati va bo‘limlari</p></div>
    <section className="grid gap-3 px-4 pt-5 sm:grid-cols-2 lg:grid-cols-4 md:px-6">
      {[
        ["Bugungi tushum", formatCurrency(summary.today?.revenue || 0)],
        ["Cheklar", `${summary.today?.salesCount || 0} ta`],
        ["Sof foyda", formatCurrency(summary.today?.profit || 0)],
        ["Kam qolgan tovar", `${summary.inventory?.lowStockCount || 0} ta`],
      ].map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><strong className="mt-2 block text-xl font-semibold text-slate-900">{value}</strong></div>)}
    </section>
    <section className="px-4 pt-6 md:px-6"><h2 className="mb-3 text-lg font-semibold text-slate-900">Asosiy bo‘limlar</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {modules.filter((module) => !("key" in module) || visibility[module.key!] !== false).map(({ label, href, icon: Icon, detail }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-4 text-slate-800 transition-colors duration-150 hover:border-blue-400 hover:bg-blue-50"><Icon size={20} className="shrink-0 text-blue-600" /><div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div></Link>)}
    </div></section>
  </main>;
}
