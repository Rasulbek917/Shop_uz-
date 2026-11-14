import AppDownloads, { WindowsDownloads } from "@/components/downloads/AppDownloads";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/marketing/PublicShell";

export default function DownloadsPage() {
  return <div className="marketing"><PublicHeader/><main className="public-section"><h1 className="mb-6">Do‘koningiz yoningizda.</h1><p className="mb-10 max-w-2xl text-slate-500">Do‘koningizni telefon va kompyuterdan boshqaring. Mavjud Savdoza hisobingiz bilan kiring.</p><div className="grid gap-6"><AppDownloads/><WindowsDownloads/></div><Link href="/login" className="public-button secondary mt-8">Brauzer orqali kirish</Link></main><PublicFooter/></div>;
}
