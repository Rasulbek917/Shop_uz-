"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Package,
  Store,
  DollarSign,
  Tag,
  CheckCircle2,
  AlertCircle,
  X,
  ShoppingCart,
  Plus,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface CentralProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  centralProduct: {
    id: string;
    sku: string;
    name: string;
    price: number;
    imageUrl?: string | null;
    brand?: string | null;
    category?: string | null;
    shopName: string;
    barcodeType: string;
    barcodeValue: string;
    description?: string | null;
    status: string;
  } | null;
  onImportSuccess: (importedProduct: any, andAddToCart: boolean) => void;
}

export default function CentralProductModal({
  isOpen,
  onClose,
  centralProduct,
  onImportSuccess,
}: CentralProductModalProps) {
  const [salePrice, setSalePrice] = useState<number>(centralProduct?.price || 0);
  const [initialStock, setInitialStock] = useState<number>(1);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if centralProduct changes
  React.useEffect(() => {
    if (centralProduct) {
      setSalePrice(centralProduct.price || 0);
      setInitialStock(1);
      setError(null);
    }
  }, [centralProduct]);

  if (!isOpen || !centralProduct) return null;

  const isInactive = centralProduct.status === "INACTIVE";

  const handleImport = async (andAddToCart: boolean) => {
    setError(null);
    setIsImporting(true);

    try {
      const res = await fetch("/api/products/central-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: centralProduct.sku,
          name: centralProduct.name,
          barcodeValue: centralProduct.barcodeValue,
          barcodeType: centralProduct.barcodeType,
          salePrice: Number(salePrice),
          initialStock: Number(initialStock),
          unit: "dona",
          categoryName: centralProduct.category,
          brandName: centralProduct.brand,
          description: centralProduct.description,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || "Import qilishda xatolik yuz berdi");
        setIsImporting(false);
        return;
      }

      onImportSuccess(data.product, andAddToCart);
      onClose();
    } catch (e: any) {
      setError("Tarmoq xatosi: " + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-brand-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Markaziy Baza: Mahsulot Topildi!</h3>
              <p className="text-xs text-brand-100 mt-0.5">
                Product Code Center tarmog'idagi ro'yxatdan olingan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isInactive && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>DIQQAT: Ushbu mahsulot markaziy tizimda nofaol deb belgilangan.</span>
            </div>
          )}

          {/* Product Details Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-extrabold text-slate-900 text-sm block">
                  {centralProduct.name}
                </span>
                <span className="font-mono text-brand-700 font-bold mt-0.5 inline-block">
                  SKU: {centralProduct.sku}
                </span>
              </div>
              <span className="font-mono text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded font-bold text-slate-600">
                {centralProduct.barcodeType}: {centralProduct.barcodeValue}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-slate-600">
              <div>
                <span className="text-slate-400 block text-[10px]">Tavsiya narx:</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(centralProduct.price)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Yaratgan do'kon:</span>
                <span className="font-medium text-slate-800">{centralProduct.shopName}</span>
              </div>
            </div>

            {(centralProduct.category || centralProduct.brand) && (
              <div className="text-slate-500 pt-1">
                Kategoriya: <span className="font-medium text-slate-700">{[centralProduct.brand, centralProduct.category].filter(Boolean).join(" • ")}</span>
              </div>
            )}
          </div>

          {/* Custom Store Configurations */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                  Do'koningizdagi narx <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={salePrice}
                    onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                  Boshlang'ich qoldiq <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={initialStock}
                    onChange={(e) => setInitialStock(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              * Do'kon narxi va qoldig'i markaziy narxdan farq qilishi mumkin. Siz o'zingizga mos qiymatni o'rnatasiz.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Bekor qilish
            </button>

            <button
              type="button"
              disabled={isImporting}
              onClick={() => handleImport(false)}
              className="w-full sm:flex-1 px-4 py-3 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-800 text-xs font-bold transition-colors disabled:opacity-50"
            >
              Faqat do'konga import qilish
            </button>

            <button
              type="button"
              disabled={isImporting}
              onClick={() => handleImport(true)}
              className="w-full sm:flex-1 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-extrabold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ShoppingCart className="w-4 h-4" />
              Qabul qilib Savatga qo'shish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
