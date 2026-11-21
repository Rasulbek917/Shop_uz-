import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { DemoPlayer } from "@/components/marketing/Experience";

export default async function GuidePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <main className="operator-page mx-auto max-w-6xl space-y-5 pb-10">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#1e50b3]">Amaliy qo‘llanma</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Savdoza bilan ishlash</h1>
      <p className="mt-1 text-sm text-slate-600">Kirish, mahsulot va ombor, POS savdosi, smena va hisobotlar o‘zbekcha ovozda ko‘rsatiladi.</p>
    </div>
    <DemoPlayer />
    <p className="text-sm text-slate-500">Videoda namuna do‘kon ma’lumotlari ishlatilgan. <Link href={user.role === "CASHIER" ? "/kassir" : user.role === "WAREHOUSEMAN" ? "/omborchi" : user.role === "SUPER_ADMIN" ? "/super-admin" : "/admin"} className="font-semibold text-[#1e50b3]">Ishga qaytish →</Link></p>
  </main>;
}
