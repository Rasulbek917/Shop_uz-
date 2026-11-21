"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Barcode, CheckCircle2, Layers, Package, PlusCircle, QrCode, RefreshCw } from "lucide-react";
import BarcodeNav from "@/components/barcode/BarcodeNav";

export default function BarcodeDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/barcode/stats");
      const data = await response.json();
      if (data.success) setStats(data.data);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Sub Navigation */}
      <BarcodeNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <QrCode className="w-7 h-7 text-[#1e50b3]" />
            QR & Shtrix-kodlar Boshqaruv Paneli
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Do'kondagi barcha tovarlar uchun unikal shtrix va QR kodlarni generatsiya qilish, ko'rish va chop etish markazi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 shadow-sm transition-colors"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/admin/shtrix-kodlar/yaratish"
            className="inline-flex items-center gap-2 bg-[#1e50b3] hover:bg-[#123d99] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Yangi kod yaratish
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Jami Kodlar</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {isLoading ? "..." : stats?.totalProducts || 0}
            </p>
            <span className="text-[11px] text-primary-600 font-semibold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> Omborda ro'yxatda
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-50 text-[#1e50b3] flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">QR-kodlar</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {isLoading ? "..." : stats?.qrCount || 0}
            </p>
            <span className="text-[11px] text-slate-500 font-medium mt-1">
              Mobil va 2D skanerlar
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <QrCode className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Shtrix-kodlar (Bar)</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {isLoading ? "..." : stats?.barcodeCount || 0}
            </p>
            <span className="text-[11px] text-slate-500 font-medium mt-1">
              Code 128 va EAN-13
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Barcode className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Faol Mahsulotlar</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {isLoading ? "..." : stats?.activeCount || 0}
            </p>
            <span className="text-[11px] text-primary-600 font-medium mt-1">
              Sotuvga tayyor
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      <Link
        href="/admin/shtrix-kodlar/mahsulotlar"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:text-slate-900"
      >
        <Package className="h-4 w-4" />
        Kodlar ro‘yxatini ochish
      </Link>
    </div>
  );
}
