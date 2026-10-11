"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  QrCode,
  Barcode,
  Package,
  Layers,
  PlusCircle,
  Printer,
  ScanLine,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Edit2,
  Download,
  CheckCircle2,
  XCircle,
  Store,
  Calendar,
} from "lucide-react";
import BarcodeNav from "@/components/barcode/BarcodeNav";
import BarcodeLabelCard from "@/components/barcode/BarcodeLabelCard";
import { formatCurrency, formatDate } from "@/lib/formatters";

export default function BarcodeDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, productsRes] = await Promise.all([
        fetch("/api/barcode/stats"),
        fetch("/api/products?limit=100"),
      ]);

      const statsData = await statsRes.json();
      const productsData = await productsRes.json();

      if (statsData.success) setStats(statsData.data);
      if (productsData.success) setProducts(productsData.data || []);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (product: any) => {
    const newStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (
      !confirm(
        `"${product.name}" mahsulotining statusini o'zgartirishni tasdiqlaysizmi?`
      )
    )
      return;

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...product,
          status: newStatus,
        }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error("Status toggle error:", e);
    }
  };

  // Filtered table rows
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase()) ||
      p.qrCode?.toLowerCase().includes(search.toLowerCase());

    const hasBarcode = Boolean(p.barcode);
    const hasQr = Boolean(p.qrCode);

    let matchesType = true;
    if (filterType === "BARCODE") matchesType = hasBarcode;
    if (filterType === "QR") matchesType = hasQr;

    let matchesStatus = true;
    if (filterStatus !== "ALL") matchesStatus = p.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Sub Navigation */}
      <BarcodeNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <QrCode className="w-7 h-7 text-[#16A34A]" />
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
            className="inline-flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors"
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
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> Omborda ro'yxatda
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center">
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
            <span className="text-[11px] text-emerald-600 font-medium mt-1">
              Sotuvga tayyor
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Nomi, SKU yoki shtrix-kod bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#16A34A]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 outline-none"
          >
            <option value="ALL">Barcha kod turlari</option>
            <option value="BARCODE">Faqat Shtrix-kod</option>
            <option value="QR">Faqat QR-kod</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 outline-none"
          >
            <option value="ALL">Barcha holatlar</option>
            <option value="ACTIVE">Faol</option>
            <option value="INACTIVE">Nofaol</option>
          </select>
        </div>
      </div>

      {/* Searchable, Filterable Product-Code Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Mahsulot nomi</th>
                <th className="py-3 px-4">SKU / Kod</th>
                <th className="py-3 px-4">Kod turi</th>
                <th className="py-3 px-4">Sotuv narxi</th>
                <th className="py-3 px-4">Yaratilgan sana</th>
                <th className="py-3 px-4">Holat</th>
                <th className="py-3 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Mahsulotlar topilmadi
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const effectiveCode = p.barcode || p.qrCode || "—";
                  const codeType = p.barcode ? "CODE128" : "QR";

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        {(p.category?.name || p.manufacturer?.name) && (
                          <div className="text-[11px] text-slate-400">
                            {[p.manufacturer?.name, p.category?.name].filter(Boolean).join(" • ")}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {effectiveCode}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {codeType === "QR" ? (
                            <QrCode className="w-3 h-3 text-blue-600" />
                          ) : (
                            <Barcode className="w-3 h-3 text-[#16A34A]" />
                          )}
                          {codeType}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {formatCurrency(p.salePrice)}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {formatDate(p.createdAt)}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            p.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          ></span>
                          {p.status === "ACTIVE" ? "Faol" : "Nofaol"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setSelectedProduct(p)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Etiketka & Kod"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <Link
                            href={`/admin/shtrix-kodlar/yaratish?editId=${p.id}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            title="Tahrirlash"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              p.status === "ACTIVE"
                                ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={p.status === "ACTIVE" ? "Nofaol qilish" : "Faollashtirish"}
                          >
                            {p.status === "ACTIVE" ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Label Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 font-bold"
            >
              ✕
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-4 text-center">
              Mahsulot etiketkasi
            </h3>
            <BarcodeLabelCard product={selectedProduct} />
          </div>
        </div>
      )}
    </div>
  );
}
