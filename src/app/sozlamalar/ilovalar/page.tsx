import Link from "next/link";
import AppDownloads, { WindowsDownloads } from "@/components/downloads/AppDownloads";
import { PLAN_FEATURES } from "@/lib/plans";
export default function AppsSettingsPage() {
  return <main className="mx-auto max-w-5xl space-y-7"><div><Link href="/sozlamalar" className="text-sm text-emerald-700">← Sozlamalar</Link><h1 className="text-3xl font-bold text-slate-900 mt-4">Ilovalar va tariflar</h1></div><AppDownloads/><WindowsDownloads/><section className="grid gap-5 md:grid-cols-2">{(["PRO", "MAX"] as const).map(code => <article key={code} className="rounded-2xl border border-slate-200 bg-white p-7"><h2 className="text-2xl font-bold text-slate-900">{code === "PRO" ? "Pro" : "Max"}</h2><p className="text-sm text-slate-500 mt-2">{code === "PRO" ? "Do‘kon egasi savdo va omborni o‘zi yuritishi uchun." : "Kassir va omborchi bilan birga ishlaydigan jamoa uchun."}</p><ul className="space-y-3 mt-6 text-sm">{PLAN_FEATURES[code].map(feature => <li key={feature}>✓ {feature}</li>)}</ul><Link href="/account" className="btn-secondary mt-6">Joriy narx va tarifni ko‘rish</Link></article>)}</section></main>;
}
