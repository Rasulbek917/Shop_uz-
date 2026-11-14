import Link from "next/link";
export default function PaymentReturnPage() {
  return <main className="mx-auto max-w-lg p-8 space-y-5"><h1 className="text-2xl font-bold">To‘lov natijasi kassaga yuboriladi</h1><p>Kassir oynasida tasdiqni kuting. To‘lov xizmatining tasdig‘i kelgach chek ochiladi.</p><Link className="btn-primary inline-block" href="/account">Hisobimga qaytish</Link></main>;
}
