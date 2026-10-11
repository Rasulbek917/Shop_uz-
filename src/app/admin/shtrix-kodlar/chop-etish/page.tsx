"use client";

import React, { useEffect, useState } from "react";
import {
  Printer,
  CheckSquare,
  Square,
  RefreshCw,
  Search,
  Check,
  Package,
} from "lucide-react";
import BarcodeNav from "@/components/barcode/BarcodeNav";
import BarcodeRenderer from "@/components/barcode/BarcodeRenderer";
import { formatCurrency } from "@/lib/formatters";

export default function BatchPrintPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [labelSize, setLabelSize] = useState<"58x40" | "40x30" | "80x50">("58x40");
  const [printCopies, setPrintCopies] = useState<number>(1);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/products?limit=200");
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase()) ||
      p.qrCode?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.id));
    }
  };

  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));

  const handlePrint = () => {
    const cleanup = () => {
      document.body.classList.remove("printing-barcode-label");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    document.body.classList.add("printing-barcode-label");

    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div className="space-y-6">
      <BarcodeNav />

      {/* Header (hidden on print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Printer className="w-6 h-6 text-[#16A34A]" />
            Etiketkalar Chop Etish (Ommaviy)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Bir nechta tovarlarni belgilang va termal stiker printerida bir yo'la chop eting
          </p>
        </div>

        <button
          onClick={handlePrint}
          disabled={selectedProducts.length === 0}
          className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-40"
        >
          <Printer className="w-4 h-4" />
          Chop etish ({selectedProducts.length * printCopies} ta etiketka)
        </button>
      </div>

      {/* Controls (hidden on print) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Ro'yxatdan qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#16A34A]"
            />
          </div>

          {/* Size & Copies */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Etiketka o'lchami:</span>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800"
              >
                <option value="58x40">58mm × 40mm (Standart termal)</option>
                <option value="40x30">40mm × 30mm (Ixcham)</option>
                <option value="80x50">80mm × 50mm (Katta)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Nusxa soni:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={printCopies}
                onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center font-bold"
              />
            </div>

            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 text-slate-700"
            >
              {selectedIds.length === filtered.length ? "Bekor qilish" : "Barchasini tanlash"}
            </button>
          </div>
        </div>

        {/* Product selection list */}
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
          {filtered.map((p) => {
            const isSelected = selectedIds.includes(p.id);
            return (
              <div
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                  isSelected ? "bg-emerald-50/70 font-semibold" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-[#16A34A] shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <div>
                    <span className="text-slate-900">{p.name}</span>
                    <span className="font-mono text-slate-400 ml-2">
                      ({p.barcode || p.qrCode || "—"})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-600">
                  <span className="font-bold">{formatCurrency(p.salePrice)}</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                    {p.barcode ? "BAR" : "QR"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Printable Area */}
      <div>
        <div className="no-print flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Chop etiladigan etiketkalar ({selectedProducts.length * printCopies} ta)
          </h2>
          {selectedProducts.length === 0 && (
            <span className="text-xs text-rose-500 font-semibold">
              Chop etish uchun yuqoridagi ro'yxatdan tovarlarni tanlang
            </span>
          )}
        </div>

        <div className="print-label-area barcode-print-container grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {selectedProducts.flatMap((product) =>
            Array.from({ length: printCopies }).map((_, copyIndex) => {
              const codeType = product.barcode ? "CODE128" : "QR";
              const codeValue = product.barcode || product.qrCode || "";

              return (
                <div
                  key={`${product.id}-${copyIndex}`}
                  className={`bg-white border-2 border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-between text-center page-break-inside-avoid ${
                    labelSize === "40x30" ? "max-w-[200px]" : "max-w-[260px]"
                  } mx-auto w-full`}
                  style={{ breakInside: "avoid" }}
                >
                  <div className="w-full">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                      {product.shop?.name || "SHOP MARKET"}
                    </div>
                    <div className="font-bold text-slate-900 text-xs leading-snug line-clamp-2 my-1 px-1">
                      {product.name}
                    </div>
                  </div>

                  <div className="my-1 flex items-center justify-center">
                    <BarcodeRenderer
                      type={codeType as any}
                      value={codeValue}
                      width={labelSize === "40x30" ? 1.3 : 1.7}
                      height={codeType === "QR" ? 85 : 45}
                      displayValue={true}
                      className="border-0 shadow-none p-0"
                    />
                  </div>

                  <div className="w-full mt-1 pt-1.5 border-t border-slate-200 flex items-center justify-between px-1">
                    <span className="font-mono text-[10px] font-bold text-slate-700">
                      {codeValue}
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {formatCurrency(product.salePrice)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
