import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import MenuVisibilitySettings from "@/components/settings/MenuVisibilitySettings";
export default async function AppsSettingsPage() {
  const user = await getCurrentUser();
  return <main className="operator-page mx-auto max-w-5xl space-y-6"><div><Link href="/sozlamalar" className="text-sm font-semibold text-[#1e50b3]">← Sozlamalar</Link><h1 className="mt-3 text-2xl font-bold text-slate-900">Ilovalar va bo‘limlar</h1><p className="mt-1 text-sm text-slate-500">Do‘kon menyusida kerakli bo‘limlarni yoqing yoki yashiring.</p></div>{user?.role === "SHOP_ADMIN" ? <MenuVisibilitySettings initial={user.menuVisibility || {}} /> : <p className="rounded-lg border bg-white p-5 text-sm text-slate-600">Bo‘limlarni faqat do‘kon egasi boshqaradi.</p>}<div className="flex flex-wrap gap-3"><Link href="/sozlamalar/tarif" className="btn-secondary">Tarif va obuna</Link><Link href="/sozlamalar?tab=shop" className="btn-secondary">Do‘kon sozlamalari</Link></div></main>;
}
