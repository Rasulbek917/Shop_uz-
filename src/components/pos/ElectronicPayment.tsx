"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { clientApi } from "@/lib/client-api";
import { formatCurrency } from "@/lib/formatters";
export function ElectronicPayment({ order: initial, onDone, onClose }: {
    order: any;
    onDone: (receipt: any) => void;
    onClose: () => void;
}) {
    const [order, setOrder] = useState(initial);
    const [qr, setQr] = useState("");
    const [error, setError] = useState(initial.warning || "");
    const busy = useRef(false);
    const done = useRef(false);
    async function check(cancel = false) {
        if (busy.current || done.current)
            return;
        busy.current = true;
        try {
            const result = await clientApi(`/api/pos/payments/${initial.id}`, { method: cancel ? "DELETE" : "GET" });
            setOrder(result);
            setError("");
            if (result.status === "PAID" && result.receipt) {
                done.current = true;
                onDone(result.receipt);
            }
        }
        catch (error) {
            setError((error as Error).message);
        }
        finally {
            busy.current = false;
        }
    }
    useEffect(() => {
        void check();
        const timer = setInterval(() => { void check(); }, 5000);
        return () => clearInterval(timer);
    }, [initial.id]);
    useEffect(() => {
        if (order.paymentUrl)
            QRCode.toDataURL(order.paymentUrl, { width: 280, margin: 2 }).then(setQr).catch(() => setError("QR kod yaratilmadi. To‘lov havolasini oching."));
    }, [order.paymentUrl]);
    return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
    <section className="max-h-[95vh] overflow-auto w-full max-w-md rounded-2xl bg-white p-6 space-y-4 text-center">
      <h2 className="text-xl font-bold">Elektron to‘lov</h2>
      <p className="text-2xl font-bold">{formatCurrency(order.amount)}</p>
      <p className="text-sm text-slate-500">{order.receiptNumber}</p>
      {order.status === "CANCELLED" ? <p>To‘lov bekor qilindi. Mahsulotlar omborga qaytarildi.</p> : <>
        {qr && <img src={qr} width={280} height={280} className="mx-auto" alt="To‘lov QR kodi"/>}
        <p>QR kodni telefon kamerasi bilan skanerlang yoki to‘lov sahifasini oching.</p>
        {order.paymentUrl && <a className="btn-primary block" href={order.paymentUrl} target="_blank" rel="noopener noreferrer">Karta yoki ilova orqali to‘lash</a>}
        <p role="status" className="text-sm">To‘lov tasdig‘i kutilmoqda. Tasdiqlangach chek avtomatik ochiladi.</p>
        <button className="btn-secondary" onClick={() => check()}>Natijani tekshirish</button>
        <button className="btn-secondary ml-2" onClick={() => check(true)}>To‘lovni bekor qilish</button>
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn-secondary block w-full" onClick={onClose}>{order.status === "CANCELLED" ? "Yopish" : "Keyinroq davom ettirish"}</button>
    </section>
  </div>;
}
export function PendingPayments({ onOpen }: {
    onOpen: (order: any) => void;
}) {
    const [rows, setRows] = useState<any[]>([]);
    useEffect(() => {
        let alive = true;
        const load = () => clientApi("/api/pos/payments").then(result => { if (alive)
            setRows(result); }).catch(() => { });
        void load();
        const timer = setInterval(load, 15000);
        return () => { alive = false; clearInterval(timer); };
    }, []);
    if (!rows.length)
        return null;
    return <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3"><h2 className="font-semibold">Kutilayotgan elektron to‘lovlar</h2><div className="mt-2 flex flex-wrap gap-2">{rows.map(order => <button key={order.id} className="btn-secondary" onClick={() => onOpen(order)}>{order.receiptNumber} · {formatCurrency(order.amount)}</button>)}</div></section>;
}
