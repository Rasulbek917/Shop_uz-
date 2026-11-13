import { getCurrentUser } from "@/lib/auth";
import { isMax } from "@/lib/plans";
import Link from "next/link";
export default async function MaxLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN" && !isMax(user?.planCode)) return <div className="rounded-2xl border bg-white p-10"><p className="text-indigo-600 font-bold">MAX</p><h1 className="text-2xl font-bold my-4">Jamoangiz uchun ko‘proq imkoniyat</h1><p className="mb-6">Ushbu bo‘lim Max tarifida ochiladi.</p><Link className="btn-primary" href="/account">Tarifni yangilash</Link></div>;
  return children;
}
